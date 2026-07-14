/**
 * Multi-target release build. Produces ONE binary per platform with
 * EVERY runtime asset embedded inside it — engine, OpenTofu binary,
 * provisioning templates, and blueprint catalog. The user's install is a
 * single file; on first run the wrapper extracts the assets into
 * `${DEVSTATION_HOME}/runtime/<VERSION>/` and points the engine at it
 * via `DEVSTATION_SIDECAR_DIR`.
 *
 * Pipeline per (target, platform-label):
 *   1. Compile the engine to a staging path (per-target).
 *   2. Copy that staging binary to `tui/ink/src/assets/devstation-server`
 *      and assert its arch matches the target (`assertAssetArch`) —
 *      guards against arch drift that would ship a Linux ELF
 *      inside a Windows wrapper.
 *   3. Fetch + stage the per-target OpenTofu binary at
 *      `tui/ink/src/assets/tofu`. Arch is asserted.
 *   4. Pack `templates/` and `blueprints/` as platform-agnostic
 *      `.tar.gz` UI assets.
 *   5. Compile the UI with `--include` on all four assets (engine +
 *      tofu + templates.tar.gz + blueprints.tar.gz); arch of the
 *      produced wrapper is asserted too.
 *   6. Drop a `THIRD-PARTY-NOTICES.md` covering the bundled OpenTofu.
 *   7. Archive (`.tar.gz` POSIX, `.zip` Windows). Archive content is
 *      just the binary + the notices file — no sidecar dirs.
 *
 * The UI source treats the engine as
 * BYTES at the asset path — no TypeScript import of `@server/...`.
 * `--include` is `deno compile`'s asset-embed flag, equivalent to
 * Go's `go:embed` or Rust's `include_bytes!`.
 *
 * Without arguments builds the four alpha targets; `--target <label>`
 * filters to one.
 *
 * Each archive contains:
 *   devstation(.exe)         single binary (UI + embedded engine + tofu + templates + blueprints)
 *   THIRD-PARTY-NOTICES.md   license notices for bundled software
 *
 * Caches: `.build-staging/` is per-build (wiped in `finally`).
 * `.build-cache/` is cross-build (persistent) and holds the OpenTofu
 * downloads — re-running a build doesn't re-fetch ~50MB per target.
 */
import { DenoReleaseAdapter } from "./deno-adapter.ts";
import { fetchTofu, TOFU_VERSION, tofuNotice, type TofuTarget } from "./tofu-bundle.ts";

const adapter = new DenoReleaseAdapter();
const DIST_DIR = "dist";
const SERVER_BUILD_INFO = "server/src/build-info.ts";
const UI_BUILD_INFO = "tui/ink/src/cli/version.ts";

// Where the UI's embedded-server.ts resolves the asset. Must match
// the `import.meta.resolve("./assets/devstation-server")` call there.
const UI_ASSET_DIR = "tui/ink/src/assets";
const UI_ASSET_PATH = `${UI_ASSET_DIR}/devstation-server`;

// Where we stash the per-target engine binary before copying onto the
// UI asset path. Kept out of `dist/` so `--cwd dist` doesn't pull it
// into the archive. Wiped in `finally`.
const STAGING_DIR = ".build-staging";

// Persistent cross-build cache (not wiped). OpenTofu binaries live
// here so we don't re-download ~50MB per target on every build.
const CACHE_DIR = ".build-cache";

/**
 * Asserts the binary at `path` has the executable format expected by
 * `target`. Catches arch drift where a Linux ELF leaks into a Windows
 * wrapper as the engine asset, causing Windows to refuse spawning it
 * with OS error 216 (machine type mismatch).
 *
 * Magic bytes:
 *   MZ      0x4d 0x5a              — Windows PE
 *   ELF     0x7f 0x45 0x4c 0x46    — Linux ELF
 *   Mach-O  0xfe 0xed 0xfa 0xcf    — macOS 64-bit (big-endian header)
 *           0xcf 0xfa 0xed 0xfe    — macOS 64-bit (little-endian, fat or thin)
 */
async function assertAssetArch(path: string, target: string, label: string): Promise<void> {
  const file = await Deno.open(path, { read: true });
  const head = new Uint8Array(4);
  try {
    await file.read(head);
  } finally {
    file.close();
  }

  const isPe = head[0] === 0x4d && head[1] === 0x5a;
  const isElf = head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46;
  const isMacho = (head[0] === 0xfe && head[1] === 0xed && head[2] === 0xfa && head[3] === 0xcf) ||
    (head[0] === 0xcf && head[1] === 0xfa && head[2] === 0xed && head[3] === 0xfe) ||
    (head[0] === 0xca && head[1] === 0xfe && head[2] === 0xba && head[3] === 0xbe); // universal fat

  const expectWindows = target.includes("windows");
  const expectDarwin = target.includes("apple-darwin");
  const expectLinux = target.includes("linux");

  const hex = Array.from(head, (b) => b.toString(16).padStart(2, "0")).join(" ");
  const ctx = `${label} at ${path} (target ${target}, magic ${hex})`;

  if (expectWindows && !isPe) {
    throw new Error(`${ctx} is not a Windows PE — got ${detectFmt(head)}`);
  }
  if (expectDarwin && !isMacho) {
    throw new Error(`${ctx} is not a Mach-O — got ${detectFmt(head)}`);
  }
  if (expectLinux && !isElf) {
    throw new Error(`${ctx} is not an ELF — got ${detectFmt(head)}`);
  }
}

function detectFmt(head: Uint8Array): string {
  if (head[0] === 0x4d && head[1] === 0x5a) return "PE (Windows)";
  if (head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46) {
    return "ELF (Linux)";
  }
  if (
    (head[0] === 0xfe && head[1] === 0xed) ||
    (head[0] === 0xcf && head[1] === 0xfa) ||
    (head[0] === 0xca && head[1] === 0xfe)
  ) return "Mach-O (macOS)";
  return "unknown format";
}

type Platform = {
  label: string; // used for the package directory + archive name
  target: string; // deno --target triple
  binaryExt: string; // "" on POSIX, ".exe" on Windows
  archive: "tar.gz" | "zip";
};

const ALL_PLATFORMS: Platform[] = [
  { label: "linux-x64", target: "x86_64-unknown-linux-gnu", binaryExt: "", archive: "tar.gz" },
  { label: "darwin-x64", target: "x86_64-apple-darwin", binaryExt: "", archive: "tar.gz" },
  { label: "darwin-arm64", target: "aarch64-apple-darwin", binaryExt: "", archive: "tar.gz" },
  { label: "windows-x64", target: "x86_64-pc-windows-msvc", binaryExt: ".exe", archive: "zip" },
];

function readOption(name: string, fallback?: string) {
  const index = adapter.args.indexOf(`--${name}`);
  if (index >= 0) {
    const value = adapter.args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    return value;
  }
  return fallback;
}

async function readDenoVersion() {
  const denoJson = await adapter.readJson<{ version?: string }>("deno.json");
  return denoJson.version ?? "0.0.0";
}

function buildInfoSource(version: string, gitSha: string, buildDate: string) {
  return [
    `export const VERSION = ${JSON.stringify(version)};`,
    `export const GIT_SHA = ${JSON.stringify(gitSha)};`,
    `export const BUILD_DATE = ${JSON.stringify(buildDate)};`,
    "",
  ].join("\n");
}

function selectPlatforms(): Platform[] {
  const targetFilter = readOption("target", adapter.env("DENO_TARGET"));
  if (!targetFilter) return ALL_PLATFORMS;
  const match = ALL_PLATFORMS.find((p) => p.target === targetFilter || p.label === targetFilter);
  if (!match) {
    const known = ALL_PLATFORMS.map((p) => `${p.label}=${p.target}`).join(", ");
    throw new Error(`Unknown --target: ${targetFilter}. Known: ${known}`);
  }
  return [match];
}

// Asset paths the UI's `--include` flags reference. Each must be a
// stable filename so `import.meta.resolve("./assets/<name>")` works at
// runtime regardless of host. The wrapper extracts them on first boot.
const UI_TOFU_ASSET = `${UI_ASSET_DIR}/tofu`;
const UI_TEMPLATES_ASSET = `${UI_ASSET_DIR}/templates.tar.gz`;
const UI_BLUEPRINTS_ASSET = `${UI_ASSET_DIR}/blueprints.tar.gz`;

async function packTarGz(srcDir: string, outFile: string): Promise<void> {
  // `tar -C <src> -czf <out> .` keeps entries relative ("./modules/vm/main.tf"),
  // matching what `UntarStream` on the runtime side expects to normalise.
  await adapter.run("tar", ["-czf", outFile, "-C", srcDir, "."]);
}

async function buildPlatform(platform: Platform, version: string): Promise<void> {
  const packageDir = adapter.join(DIST_DIR, `devstation-${platform.label}`);
  await adapter.ensureDir(packageDir);

  // Step 1 — engine compile to staging.
  await adapter.ensureDir(STAGING_DIR);
  const stagedEngine = adapter.join(
    STAGING_DIR,
    `devstation-server-${platform.label}${platform.binaryExt}`,
  );
  await adapter.run("deno", [
    "compile",
    "-A",
    // `createHttpClient({unsafelyIgnoreCertificateErrors:[]})` does NOT
    // skip TLS at runtime; the empty array is a no-op and even an explicit
    // hostname list is ignored unless Deno was launched with the matching
    // CLI flag. Burning the flag into the compiled binary is the only path
    // the engine controls. Scope is the engine only (NOT the UI binary) —
    // the UI only talks JSON-RPC to the local embedded engine, so it never
    // makes outbound TLS calls. Homelab Proxmox boxes ship with self-signed
    // certs by default; refusing to connect there blocks the user.
    "--unsafely-ignore-certificate-errors",
    "--include",
    "server/src/rpc.ts",
    "--include",
    "server/src/mcp.ts",
    "--target",
    platform.target,
    "--output",
    stagedEngine,
    "server/bin/devstation-server",
  ]);

  // Step 2 — promote the per-target engine to the UI's asset slot.
  // The UI's `embedded-server.ts` resolves the embed via
  // `import.meta.resolve("./assets/devstation-server")` — a stable
  // path regardless of platform.
  await adapter.ensureDir(UI_ASSET_DIR);
  await adapter.copyFile(stagedEngine, UI_ASSET_PATH);

  // Guard against arch drift: the engine asset MUST match the wrapper
  // target's arch. If a stale build left a Linux ELF in the asset slot
  // before a Windows wrapper compile, this catches it here instead of
  // letting Windows refuse to spawn with OS error 216.
  await assertAssetArch(UI_ASSET_PATH, platform.target, "engine asset");

  // Step 3 — fetch + stage the bundled OpenTofu binary as a UI asset.
  // Tofu now ships embedded inside the wrapper (no longer a sidecar file
  // in the package). Runtime extraction lands it in
  // `${DEVSTATION_HOME}/runtime/<VERSION>/tofu(.exe)`.
  const tofuCached = await fetchTofu(CACHE_DIR, platform.target as TofuTarget);
  await adapter.copyFile(tofuCached, UI_TOFU_ASSET);
  await assertAssetArch(UI_TOFU_ASSET, platform.target, "tofu asset");

  // Step 4 — pack templates + blueprints as tar.gz UI assets. These
  // are platform-agnostic data (text + yaml), packed once per build
  // and copied into the asset slot for `--include` to embed.
  const templatesSrc = "server/src/cluster/outbound/executions/proxmox/provisioning/templates";
  if (!await adapter.isDirectory(templatesSrc)) {
    throw new Error(`templates source missing: ${templatesSrc}`);
  }
  await packTarGz(templatesSrc, UI_TEMPLATES_ASSET);

  const blueprintsSrc = "blueprints";
  if (!await adapter.isDirectory(blueprintsSrc)) {
    throw new Error(`blueprints source missing: ${blueprintsSrc}`);
  }
  await packTarGz(blueprintsSrc, UI_BLUEPRINTS_ASSET);

  // Step 5 — UI binary with all four assets bundled in. The wrapper
  // alone is the entire user-facing artifact from here on.
  const uiPath = adapter.join(packageDir, `devstation${platform.binaryExt}`);
  await adapter.run("deno", [
    "compile",
    "-A",
    "--include",
    UI_ASSET_PATH,
    "--include",
    UI_TOFU_ASSET,
    "--include",
    UI_TEMPLATES_ASSET,
    "--include",
    UI_BLUEPRINTS_ASSET,
    "--target",
    platform.target,
    "--output",
    uiPath,
    "tui/ink/bin/devstation",
  ]);
  await adapter.chmod(uiPath, 0o755);
  await assertAssetArch(uiPath, platform.target, "compiled wrapper");

  // Step 6 — third-party notices ship alongside the binary (MPL 2.0
  // attribution for the bundled OpenTofu). Tiny text file; lives in
  // the archive root so distros/package maintainers can find it.
  await adapter.writeTextFile(
    adapter.join(packageDir, "THIRD-PARTY-NOTICES.md"),
    tofuNotice(TOFU_VERSION),
  );

  // Step 7 — archive: just `devstation(.exe)` + the notices file. All
  // runtime data (tofu, templates, blueprints) is embedded — no
  // sidecar dirs to extract on the user's end.
  const archiveName = `devstation-${platform.label}.${platform.archive}`;
  const archivePath = adapter.join(DIST_DIR, archiveName);
  if (platform.archive === "tar.gz") {
    await adapter.run("tar", ["-czf", archivePath, "-C", packageDir, "."]);
  } else {
    await adapter.runIn(packageDir, "zip", ["-rq", adapter.resolve(archivePath), "."]);
  }

  console.log(`Built ${adapter.resolve(archivePath)} for ${platform.target} (${version})`);
}

const versionInput = readOption("version", adapter.env("VERSION")) ?? await readDenoVersion();
const version = versionInput.startsWith("v") ? versionInput.slice(1) : versionInput;
const gitSha = readOption("git-sha", adapter.env("GITHUB_SHA")) ??
  await adapter.commandOutput("git", ["rev-parse", "--short=12", "HEAD"]) ?? "dev";
const buildDate = readOption("build-date", adapter.env("BUILD_DATE")) ?? adapter.nowIso();

const platforms = selectPlatforms();

await adapter.emptyDir(DIST_DIR);

const originalServerBuildInfo = await adapter.readTextFile(SERVER_BUILD_INFO);
const originalUiBuildInfo = await adapter.readTextFile(UI_BUILD_INFO);

try {
  const stamped = buildInfoSource(version, gitSha, buildDate);
  await adapter.writeTextFile(SERVER_BUILD_INFO, stamped);
  await adapter.writeTextFile(UI_BUILD_INFO, stamped);

  for (const platform of platforms) {
    await buildPlatform(platform, version);
  }
} finally {
  await adapter.writeTextFile(SERVER_BUILD_INFO, originalServerBuildInfo);
  await adapter.writeTextFile(UI_BUILD_INFO, originalUiBuildInfo);
  // Asset files are per-build artifacts — they get overwritten each
  // platform anyway, but cleaning them keeps the working tree tidy
  // and prevents accidentally checking them in.
  for (const asset of [UI_ASSET_PATH, UI_TOFU_ASSET, UI_TEMPLATES_ASSET, UI_BLUEPRINTS_ASSET]) {
    try {
      await Deno.remove(asset);
    } catch { /* not present */ }
  }
  try {
    await Deno.remove(UI_ASSET_DIR);
  } catch { /* dir non-empty or absent */ }
  try {
    await Deno.remove(STAGING_DIR, { recursive: true });
  } catch { /* not present */ }
}
