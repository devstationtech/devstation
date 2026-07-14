/**
 * On-disk materialisation of the runtime assets embedded in the wrapper
 * binary. The wrapper's `--include` flags carry three blobs:
 *
 *   ./assets/tofu                — the provisioning runtime binary (per-target)
 *   ./assets/templates.tar.gz    — provisioning module sources
 *   ./assets/blueprints.tar.gz   — first-party blueprint catalog
 *
 * On first run we extract them under
 * `${DEVSTATION_HOME}/runtime/<VERSION>/` (idempotent — cache-keyed by
 * the build's VERSION string). Subsequent runs see the populated dir
 * and return immediately. The runtime dir becomes the value the
 * wrapper exports as `DEVSTATION_SIDECAR_DIR` before spawning the
 * engine, so the engine resolves all three assets through its existing
 * sidecar contract — no domain change.
 *
 * Layering note: this file reads assets **as bytes** only, all host I/O
 * routed through the platform runtime. The zero-coupling invariant
 * (`tui/ink/src/** toNotImport server/src/**`) holds.
 */
import { join } from "@std/path";
import { executableName, markExecutable } from "@ui/shared/platform/executables.ts";
import { UntarStream } from "@std/tar/untar-stream";
import { VERSION } from "@ui/cli/version.ts";
import { defaultDevstationHome } from "@ui/cli/paths.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { fs, env } = denoRuntime;

const TOFU_ASSET_URL = import.meta.resolve("./assets/tofu");
const TEMPLATES_ASSET_URL = import.meta.resolve("./assets/templates.tar.gz");
const BLUEPRINTS_ASSET_URL = import.meta.resolve("./assets/blueprints.tar.gz");

const READY_MARKER = ".extracted";

/**
 * Ensures the runtime assets (runtime binary + templates + blueprints)
 * are present under `${DEVSTATION_HOME}/runtime/<VERSION>/`. Idempotent.
 *
 * Returns the runtime dir path. The wrapper sets
 * `DEVSTATION_SIDECAR_DIR` to it before spawning the engine.
 *
 * In dev mode (assets not embedded — the `--include` flags only fire at
 * compile time), all three reads fail and we return `null`. The
 * caller's existing PATH/source fallback paths take over.
 */
export async function ensureRuntimeAssets(): Promise<string | null> {
  const runtimeDir = runtimeDirFor(VERSION);
  const marker = join(runtimeDir, READY_MARKER);

  try {
    await fs.stat(marker);
    return runtimeDir; // already extracted at this version
  } catch {
    // not yet — fall through and extract
  }

  const runtimeBytes = await readAssetBytes(TOFU_ASSET_URL);
  const templatesBytes = await readAssetBytes(TEMPLATES_ASSET_URL);
  const blueprintsBytes = await readAssetBytes(BLUEPRINTS_ASSET_URL);

  if (!runtimeBytes || !templatesBytes || !blueprintsBytes) {
    // Dev mode (not a compiled binary, or `--include` didn't fire).
    // Caller handles the absence by falling back to source paths.
    return null;
  }

  await fs.mkdir(runtimeDir, { recursive: true, mode: 0o700 });

  await writeRuntimeBinary(runtimeDir, runtimeBytes);
  await writeArchive(runtimeDir, "templates", templatesBytes);
  await writeArchive(runtimeDir, "blueprints", blueprintsBytes);

  await fs.writeTextFile(marker, `${VERSION}\n${new Date().toISOString()}\n`);
  return runtimeDir;
}

function runtimeDirFor(version: string): string {
  const root = env.get("DEVSTATION_HOME") ?? defaultDevstationHome();
  return join(root, "runtime", version);
}

async function readAssetBytes(url: string): Promise<Uint8Array | null> {
  try {
    return await fs.readFile(new URL(url));
  } catch {
    return null;
  }
}

async function writeRuntimeBinary(runtimeDir: string, bytes: Uint8Array): Promise<void> {
  // The bundled binary is named `tofu` (build artifact of the OpenTofu
  // provisioning runtime); the rest of the codebase stays tool-agnostic.
  const path = join(runtimeDir, executableName("tofu"));
  await atomicWrite(path, bytes);
  await markExecutable(path);
}

async function writeArchive(
  runtimeDir: string,
  subdir: string,
  bytes: Uint8Array,
): Promise<void> {
  const targetDir = join(runtimeDir, subdir);
  await wipeIfExists(targetDir);
  await fs.mkdir(targetDir, { recursive: true, mode: 0o700 });

  const source = new Blob([bytes as BlobPart]).stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new UntarStream());

  for await (const entry of source) {
    // tar paths look like `./modules/vm/main.tf` — normalize and join under target dir
    const relative = entry.path.replace(/^\.\//, "").replace(/^\//, "");
    if (!relative) continue;
    const outPath = join(targetDir, relative);

    if (entry.header.typeflag === "5") {
      // directory
      await fs.mkdir(outPath, { recursive: true, mode: 0o700 });
      entry.readable?.cancel();
      continue;
    }

    await fs.mkdir(dirname(outPath), { recursive: true, mode: 0o700 });
    if (entry.readable) {
      const writable = await fs.createWritable(outPath);
      await entry.readable.pipeTo(writable);
    } else {
      await fs.writeFile(outPath, new Uint8Array(0));
    }
  }
}

async function atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
  const tmp = `${path}.tmp.${env.pid}`;
  await fs.writeFile(tmp, bytes);
  await fs.rename(tmp, path);
}

async function wipeIfExists(path: string): Promise<void> {
  try {
    await fs.remove(path, { recursive: true });
  } catch (error) {
    if (!fs.isNotFound(error)) throw error;
  }
}

function dirname(path: string): string {
  const sep = path.includes("\\") ? "\\" : "/";
  const i = path.lastIndexOf(sep);
  return i <= 0 ? "." : path.slice(0, i);
}
