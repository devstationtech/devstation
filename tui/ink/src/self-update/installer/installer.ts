/**
 * Binary installer — downloads a release archive, verifies its SHA256,
 * extracts the `devstation(.exe)` binary, and swaps it in.
 *
 * The common flow (download → verify → extract) lives here; the actual
 * swap is delegated to a per-OS `SwapStrategy` chosen by `createInstaller`.
 * That keeps the single `if (os)` in one composition point.
 *
 * Archives (from `release/scripts/build-release.ts`) contain just
 * the single binary + THIRD-PARTY-NOTICES.md — no sidecar dirs. We pull
 * the one binary out via `tar -xf` (GNU tar / bsdtar autodetect gzip and
 * zip; available on Linux, macOS, and Windows 10+).
 */
import { join } from "@std/path";
import { markExecutable } from "@ui/shared/platform/executables.ts";
import { defaultDevstationHome } from "@ui/cli/paths.ts";
import type { Asset } from "@ui/self-update/manifest.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { fs, env, process } = denoRuntime;

export type InstallPhase = "download" | "verify" | "extract" | "install";

export type InstallOutcome =
  | { kind: "installed"; previous: string }
  | { kind: "staged"; version: string }
  | { kind: "failed"; reason: string };

export type RollbackOutcome =
  | { kind: "rolled-back"; restored: string }
  | { kind: "nothing" }
  | { kind: "failed"; reason: string };

export interface SwapStrategy {
  /** Move the freshly-extracted binary into place. */
  swap(extractedBinary: string, version: string): Promise<InstallOutcome>;
  rollback(): Promise<RollbackOutcome>;
}

export type InstallOptions = {
  asset: Asset;
  version: string;
  onProgress?: (phase: InstallPhase) => void;
};

export class BinaryInstaller {
  constructor(
    private readonly swapStrategy: SwapStrategy,
    private readonly binaryName: string, // "devstation" | "devstation.exe"
  ) {}

  async install(opts: InstallOptions): Promise<InstallOutcome> {
    const stageDir = join(updatesRoot(), opts.version);
    try {
      await fs.mkdir(stageDir, { recursive: true });

      opts.onProgress?.("download");
      const archivePath = join(stageDir, "archive");
      const bytes = await download(opts.asset.url);
      await fs.writeFile(archivePath, bytes);

      opts.onProgress?.("verify");
      const digest = await sha256Hex(bytes);
      if (digest.toLowerCase() !== opts.asset.sha256.toLowerCase()) {
        return {
          kind: "failed",
          reason: `checksum mismatch — expected ${opts.asset.sha256.slice(0, 12)}…, got ${
            digest.slice(0, 12)
          }…. Download may be corrupt or tampered; aborting.`,
        };
      }

      opts.onProgress?.("extract");
      await extract(archivePath, stageDir);
      const extractedBinary = join(stageDir, this.binaryName);
      try {
        await fs.stat(extractedBinary);
      } catch {
        return { kind: "failed", reason: `archive did not contain ${this.binaryName}` };
      }
      await markExecutable(extractedBinary);

      opts.onProgress?.("install");
      const outcome = await this.swapStrategy.swap(extractedBinary, opts.version);

      // Both strategies move the binary OUT of the stage dir (POSIX renames
      // it over the target; Windows copies it to `<target>.new`), so on
      // success the stage holds only the ~100MB archive and extraction
      // leftovers — without this, every update parked them in the user's
      // home forever. Best-effort: a failed cleanup must not fail an
      // otherwise successful install.
      if (outcome.kind !== "failed") {
        await fs.remove(stageDir, { recursive: true }).catch(() => {});
      }
      return outcome;
    } catch (err) {
      return { kind: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  }

  rollback(): Promise<RollbackOutcome> {
    return this.swapStrategy.rollback();
  }
}

// --- shared helpers ---

export function updatesRoot(): string {
  const home = env.get("DEVSTATION_HOME") ?? defaultDevstationHome();
  return join(home, "updates");
}

export function previousPath(execPath: string): string {
  return execPath + ".previous";
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "accept": "application/octet-stream" } });
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function extract(archivePath: string, destDir: string): Promise<void> {
  // `tar -xf` autodetects gzip (.tar.gz) and zip on GNU tar 1.30+ /
  // bsdtar (macOS, Windows 10+). One dependency, all targets.
  const out = await process.run("tar", ["-xf", archivePath, "-C", destDir]);
  if (!out.success) {
    const stderr = new TextDecoder().decode(out.stderr);
    throw new Error(`extract failed (tar exit ${out.code}): ${stderr.slice(0, 200)}`);
  }
}
