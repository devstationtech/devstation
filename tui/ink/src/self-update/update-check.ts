/**
 * Passive, cache-aware update check. Runs on home mount; never blocks
 * the UI and never throws — any failure degrades to `unknown`.
 *
 * Flow:
 *   1. Short-circuit to `skipped` for dev builds, opt-out env, or a
 *      non-interactive stdout (pipe / `mcp serve`).
 *   2. Read `~/.devstation/update-check.json`. If fresh (< window),
 *      decide from the cached `latestVersion` without touching the net.
 *   3. Else fetch the manifest (with a short timeout), refresh the
 *      cache, and decide.
 */
import { join } from "@std/path";
import { VERSION } from "@ui/cli/version.ts";
import { defaultDevstationHome } from "@ui/cli/paths.ts";
import { currentTarget, Version } from "@ui/self-update/version.ts";
import { fetchManifest, type Manifest, manifestUrl } from "@ui/self-update/manifest.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { fs, env, terminal } = denoRuntime;

export type UpdateStatus =
  | { kind: "current" }
  | { kind: "available"; latest: string; manifest: Manifest }
  | { kind: "skipped"; reason: "dev" | "disabled" | "non-interactive" | "unsupported-target" }
  | { kind: "unknown" };

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT_MS = 4000;
const CACHE_FILE = "update-check.json";

type Cache = {
  checkedAt: number;
  latestVersion: string;
  manifestUrl: string;
};

function homeDir(): string {
  return env.get("DEVSTATION_HOME") ?? defaultDevstationHome();
}

function cachePath(): string {
  return join(homeDir(), CACHE_FILE);
}

function windowMs(): number {
  const raw = env.get("DEVSTATION_UPDATE_CHECK_WINDOW_MS");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_WINDOW_MS;
}

function isInteractive(): boolean {
  try {
    return terminal.stdoutIsTerminal();
  } catch {
    return false;
  }
}

async function readCache(): Promise<Cache | null> {
  try {
    const raw = JSON.parse(await fs.readTextFile(cachePath())) as Partial<Cache>;
    if (
      typeof raw.checkedAt === "number" &&
      typeof raw.latestVersion === "string" &&
      typeof raw.manifestUrl === "string"
    ) {
      return raw as Cache;
    }
  } catch {
    /* missing / corrupt — treat as no cache */
  }
  return null;
}

async function writeCache(cache: Cache): Promise<void> {
  try {
    await fs.mkdir(homeDir(), { recursive: true });
    await fs.writeTextFile(cachePath(), JSON.stringify(cache, null, 2) + "\n");
  } catch {
    /* cache is best-effort; ignore write failures */
  }
}

function decide(latest: string, manifest?: Manifest): UpdateStatus {
  const current = new Version(VERSION);
  const latestV = new Version(latest);
  if (latestV.isNewerThan(current)) {
    // We can only surface "available" with a manifest in hand (the
    // `/update` flow needs the asset URLs). Cache-only hits without a
    // manifest still report available — the `/update` command re-fetches.
    return { kind: "available", latest, manifest: manifest ?? emptyManifest(latest) };
  }
  return { kind: "current" };
}

function emptyManifest(version: string): Manifest {
  return { version, tag: `v${version}`, assets: {} };
}

/**
 * Resolves the update status. Pure best-effort: returns `unknown` on
 * any network/parse error so the caller can render nothing.
 *
 * `opts.force` means an explicit request (the `/update` flow, or a
 * future headless `devstation update`): it skips the cache AND bypasses
 * the passive-only gates (dev build, opt-out env, non-interactive
 * stdout). The only gate `force` still honours is `unsupported-target`
 * — we can't install what we don't publish.
 */
export async function checkForUpdate(opts: { force?: boolean } = {}): Promise<UpdateStatus> {
  if (currentTarget() === null) return { kind: "skipped", reason: "unsupported-target" };

  if (!opts.force) {
    if (new Version(VERSION).isDev()) return { kind: "skipped", reason: "dev" };
    if (env.get("DEVSTATION_DISABLE_UPDATE_CHECK")) {
      return { kind: "skipped", reason: "disabled" };
    }
    if (!isInteractive()) return { kind: "skipped", reason: "non-interactive" };
  }

  const url = manifestUrl();

  if (!opts.force) {
    const cache = await readCache();
    if (cache && cache.manifestUrl === url && Date.now() - cache.checkedAt < windowMs()) {
      return decide(cache.latestVersion);
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let manifest: Manifest;
    try {
      manifest = await fetchManifest(url, controller.signal);
    } finally {
      clearTimeout(timer);
    }
    await writeCache({ checkedAt: Date.now(), latestVersion: manifest.version, manifestUrl: url });
    return decide(manifest.version, manifest);
  } catch {
    return { kind: "unknown" };
  }
}
