import { join } from "node:path";
import { executableName, markExecutable } from "@ui/shared/platform/executables.ts";
import { ensureRuntimeAssets } from "@ui/embedded-assets.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { fs, env } = denoRuntime;

/**
 * Locates the engine binary the UI should spawn for RPC.
 *
 * In a release build, the engine binary is embedded as an asset via
 * `deno compile --include dist/devstation-server-<target>` and lives
 * adjacent to the UI source at compile time. At runtime we extract it
 * to a cache dir (hash-keyed so updates invalidate cleanly) and spawn
 * from there — operating systems require an actual filesystem path
 * with the executable bit to fork/exec, so an in-memory `Uint8Array`
 * can't be used directly.
 *
 * Sibling assets (the bundled provisioning runtime, templates and
 * blueprints catalog) ride in the same wrapper via `--include` and are
 * materialised by `embedded-assets.ts` into
 * `${DEVSTATION_HOME}/runtime/<VERSION>/`. That dir becomes the value
 * of `DEVSTATION_SIDECAR_DIR` that the engine reads, so all sidecar
 * resolution flows through one path.
 *
 * In dev mode the asset isn't present (we never `--include` it during
 * `deno run`), so we fall back to the well-known source path of the
 * standalone engine binary. The fallback also covers a user-supplied
 * override via `$DEVSTATION_SERVER`.
 *
 * Layering note: this file reads the engine **as bytes**, never as
 * source code. The zero-coupling invariant (`tui/ink/src/** toNotImport
 * server/src/**`) is preserved — `--include` registers a file asset
 * with `deno compile`, not a TypeScript import.
 */

/** Asset URL — resolved at compile time, missing in dev. */
const ASSET_URL = import.meta.resolve("./assets/devstation-server");

/**
 * Returns a spawnable command for the engine, choosing between the
 * embedded asset and the dev shim.
 */
export async function resolveEngineCommand(): Promise<{
  readonly command: string;
  readonly args: readonly string[];
}> {
  // Extract bundled provisioning runtime / templates / blueprints to the runtime dir
  // and point the engine at it via DEVSTATION_SIDECAR_DIR. No-op when
  // an operator already set DEVSTATION_SIDECAR_DIR, and no-op in dev
  // mode (the embedded assets aren't present, so the function returns
  // null and the engine's own dev fallbacks take over).
  await propagateWrapperSidecarDir();

  const override = env.get("DEVSTATION_SERVER");
  if (override) return { command: override, args: [] };

  const asset = await readEmbeddedAsset();
  if (asset) {
    const path = await materializeAsset(asset);
    return { command: path, args: [] };
  }

  // Dev fallback: standalone engine entry from source. Won't exist in
  // a compiled binary — only when running via `deno run`.
  return { command: "./server/bin/devstation-server", args: [] };
}

async function propagateWrapperSidecarDir(): Promise<void> {
  if (env.get("DEVSTATION_SIDECAR_DIR")) return; // operator override wins
  try {
    const execPath = env.execPath();
    // `deno` (dev mode) → execPath is the deno binary; skip — embedded
    // assets aren't bundled in dev and the engine's resolver knows how
    // to fall back to source/PATH paths.
    const base = execPath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
    if (base.startsWith("deno")) return;

    // Production: extract the bundled assets and point the engine at
    // the runtime dir.
    const runtime = await ensureRuntimeAssets();
    if (runtime) {
      env.set("DEVSTATION_SIDECAR_DIR", runtime);
      return;
    }

    // Asset extraction returned null (e.g. corrupted bundle). Last
    // resort: point at the wrapper's own dir — installers that drop
    // sidecars there still work as a manual override.
    const sep = execPath.includes("\\") ? "\\" : "/";
    const dir = execPath.slice(0, execPath.lastIndexOf(sep));
    if (dir) env.set("DEVSTATION_SIDECAR_DIR", dir);
  } catch {
    // Permission denied / running in a hostile sandbox — engine will
    // fall back to its in-binary search path. No user-facing impact.
  }
}

async function readEmbeddedAsset(): Promise<Uint8Array | null> {
  try {
    const url = new URL(ASSET_URL);
    return await fs.readFile(url);
  } catch {
    // File not bundled (dev mode) — caller falls back.
    return null;
  }
}

/**
 * Writes the asset to a cache directory keyed by content hash. If the
 * destination already exists and matches the hash, skip the write. The
 * caller spawns the returned path; OS fork/exec needs a real file path
 * with the `+x` bit set.
 */
async function materializeAsset(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const hash = bytesToHex(new Uint8Array(digest)).slice(0, 16);
  const cacheDir = engineCacheDir();
  await fs.mkdir(cacheDir, { recursive: true });

  const path = join(cacheDir, executableName(`devstation-server-${hash}`));

  // Idempotency: if a file with the same hash-suffix path already
  // exists with the right size, trust it. We don't re-hash the existing
  // file (the hash is already encoded in the filename — flipping a
  // single byte would change the path).
  try {
    const stat = await fs.stat(path);
    if (stat.size === bytes.byteLength) return path;
  } catch {
    // Doesn't exist — fall through to write.
  }

  // Atomic write: stage as <path>.tmp.<pid>, fsync via close, then rename.
  const tmpPath = `${path}.tmp.${env.pid}`;
  await fs.writeFile(tmpPath, bytes);
  await markExecutable(tmpPath);
  await fs.rename(tmpPath, path);
  return path;
}

function engineCacheDir(): string {
  const override = env.get("DEVSTATION_ENGINE_CACHE");
  if (override) return override;

  if (env.os === "windows") {
    const localAppData = env.get("LOCALAPPDATA");
    if (localAppData) return join(localAppData, "devstation", "engine-cache");
  }
  const tmp = env.get("TMPDIR") ?? env.get("TMP") ?? "/tmp";
  return join(tmp, "devstation-engine-cache");
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
