/**
 * OpenTofu (bpg/proxmox-friendly Terraform fork, MPL 2.0) is bundled as
 * a sidecar binary next to the devstation wrapper. The engine resolves
 * the binary via `DEVSTATION_SIDECAR_DIR + tofu(.exe)` — no PATH lookup,
 * no manual install, zero user setup.
 *
 * This module fetches the platform-specific OpenTofu binary from the
 * official GitHub release, caches it under `.build-cache/tofu-<version>/
 * <target>/`, and returns the path to copy into the package dir.
 *
 * Cache lives OUTSIDE the per-build `.build-staging/` (which is wiped
 * in `finally`). First build pays ~50MB per target download; subsequent
 * builds reuse.
 */
import { ensureDir } from "@std/fs";
import { join } from "@std/path";

export const TOFU_VERSION = "1.12.0";

const TOFU_BASE_URL = "https://github.com/opentofu/opentofu/releases/download";

/**
 * Pinned SHA256 of each release archive, copied from the upstream
 * `tofu_<version>_SHA256SUMS` asset. A download that doesn't
 * match is a hard build failure — a MITM'd fetch or a poisoned
 * `.build-cache/` must never flow into user binaries, where our own
 * `checksums.txt` would then faithfully attest the tampered artifact.
 *
 * Bumping TOFU_VERSION: fetch
 * `https://github.com/opentofu/opentofu/releases/download/v<version>/tofu_<version>_SHA256SUMS`
 * and update the four entries together.
 */
const TOFU_SHA256: Readonly<Record<string, string>> = {
  "tofu_1.12.0_linux_amd64.zip": "8d7650fd42b6d790f9f747604393ccd0a9035376bccc4f1688b905d7c5bb1137",
  "tofu_1.12.0_darwin_amd64.zip":
    "761dc6688325721be230f95b94382bc06ffe59d87cb25c94ef8a37d9cb0c0014",
  "tofu_1.12.0_darwin_arm64.zip":
    "1b09890dc4ed842bebb55b8c958943b28bc025b3728ee2e5f848c30ee3406841",
  "tofu_1.12.0_windows_amd64.zip":
    "7253abf6ce9c0e88e0cc188c5c883e02353b6c5ffcf2125e6c307348ca223df0",
};

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Throws unless `bytes` match the pinned SHA256 for `archive`. An archive
 * with no pin is also a hard failure — a version bump that forgets to
 * refresh the pins must not silently skip verification.
 */
export async function verifyTofuArchive(
  archive: string,
  bytes: Uint8Array,
  pins: Readonly<Record<string, string>> = TOFU_SHA256,
): Promise<void> {
  const pinned = pins[archive];
  if (!pinned) {
    throw new Error(
      `no pinned SHA256 for ${archive} — update TOFU_SHA256 from the upstream SHA256SUMS asset`,
    );
  }
  const actual = await sha256Hex(bytes);
  if (actual !== pinned) {
    throw new Error(
      `SHA256 mismatch for ${archive}: expected ${pinned}, got ${actual} — ` +
        `refusing to bundle (possible MITM or tampered upstream asset)`,
    );
  }
}

export type TofuTarget =
  | "x86_64-unknown-linux-gnu"
  | "x86_64-apple-darwin"
  | "aarch64-apple-darwin"
  | "x86_64-pc-windows-msvc";

type AssetSpec = {
  archive: string; // .zip filename
  binary: string; // tofu OR tofu.exe inside the zip
};

function assetFor(target: TofuTarget, version: string): AssetSpec {
  switch (target) {
    case "x86_64-unknown-linux-gnu":
      return { archive: `tofu_${version}_linux_amd64.zip`, binary: "tofu" };
    case "x86_64-apple-darwin":
      return { archive: `tofu_${version}_darwin_amd64.zip`, binary: "tofu" };
    case "aarch64-apple-darwin":
      return { archive: `tofu_${version}_darwin_arm64.zip`, binary: "tofu" };
    case "x86_64-pc-windows-msvc":
      return { archive: `tofu_${version}_windows_amd64.zip`, binary: "tofu.exe" };
  }
}

export function tofuSidecarName(target: TofuTarget): string {
  return target === "x86_64-pc-windows-msvc" ? "tofu.exe" : "tofu";
}

/**
 * Returns the path of a cached OpenTofu binary for the given target.
 * Downloads + extracts on cache miss.
 */
export async function fetchTofu(
  cacheRoot: string,
  target: TofuTarget,
  version: string = TOFU_VERSION,
): Promise<string> {
  const { archive, binary } = assetFor(target, version);
  const cacheDir = join(cacheRoot, `tofu-${version}`, target);
  const binaryPath = join(cacheDir, binary);
  const markerPath = `${binaryPath}.sha256`;

  // Cache hit must re-verify: the binary is rehashed against the marker
  // written at verified-extract time, so a tampered/corrupted cache fails
  // the build instead of flowing into user binaries. A pre-verification
  // cache (binary without marker) is treated as a miss and re-fetched.
  try {
    const [expected, bytes] = await Promise.all([
      Deno.readTextFile(markerPath),
      Deno.readFile(binaryPath),
    ]);
    const actual = await sha256Hex(bytes);
    if (actual !== expected.trim()) {
      throw new Error(
        `cached OpenTofu binary at ${binaryPath} does not match its verified ` +
          `checksum — clear .build-cache/ and rebuild (expected ${expected.trim()}, got ${actual})`,
      );
    }
    return binaryPath;
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not match")) throw error;
    // cache miss — fall through to download
  }

  await ensureDir(cacheDir);
  const url = `${TOFU_BASE_URL}/v${version}/${archive}`;
  console.log(`Fetching OpenTofu ${version} for ${target}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const archivePath = join(cacheDir, archive);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await verifyTofuArchive(archive, bytes);
  await Deno.writeFile(archivePath, bytes);

  const unzip = await new Deno.Command("unzip", {
    args: ["-o", "-q", archivePath, "-d", cacheDir],
    stderr: "inherit",
  }).output();
  if (!unzip.success) {
    throw new Error(`unzip failed on ${archivePath} (exit ${unzip.code})`);
  }

  if (target !== "x86_64-pc-windows-msvc") {
    await Deno.chmod(binaryPath, 0o755);
  }

  // Marker enables cache-hit re-verification on later builds.
  await Deno.writeTextFile(markerPath, await sha256Hex(await Deno.readFile(binaryPath)));

  await Deno.remove(archivePath);
  return binaryPath;
}

/**
 * Returns the MPL 2.0 third-party notice for bundled OpenTofu.
 * The release script writes this to `THIRD-PARTY-NOTICES.md` inside
 * each archive.
 */
export function tofuNotice(version: string = TOFU_VERSION): string {
  return [
    "# Third-Party Software Notices",
    "",
    "DevStation bundles the following third-party binaries to deliver a zero-",
    "setup experience. Their original copyright and license terms apply to",
    "those binaries; the rest of DevStation is licensed separately.",
    "",
    `## OpenTofu ${version}`,
    "",
    "DevStation bundles the OpenTofu binary (https://opentofu.org) so that",
    "infrastructure provisioning works out of the box without requiring a",
    "manual install. OpenTofu is a Linux Foundation fork of Terraform 1.5",
    "and is fully CLI-compatible with the same `.tf`/`.tfvars` configs.",
    "",
    "- **Source:** https://github.com/opentofu/opentofu",
    `- **Release:** https://github.com/opentofu/opentofu/releases/tag/v${version}`,
    "- **License:** Mozilla Public License, version 2.0 (MPL-2.0)",
    "- **License text:** https://github.com/opentofu/opentofu/blob/main/LICENSE",
    "",
    "MPL-2.0 grants you the right to use, copy, modify, and redistribute the",
    "OpenTofu binary as included here. Modifications to the OpenTofu source",
    "code would have to be released under MPL-2.0; DevStation does not modify",
    "the binary and bundles it verbatim.",
    "",
  ].join("\n");
}
