/**
 * `latest.json` manifest — the single source of truth for releases.
 *
 * The CLI NEVER composes a `github.com/<owner>/<repo>/...` URL itself.
 * It reads the asset URL straight from this manifest, so swapping the
 * distribution backend (the repo's own Releases, a public mirror repo,
 * or a CDN) is a manifest edit, not a code change.
 *
 * Shape mirrors what `release/scripts/latest-manifest.ts` emits.
 */
import type { TargetLabel } from "@ui/self-update/version.ts";
import { denoRuntime, type Env } from "@ui/shared/platform/mod.ts";

export type Asset = {
  readonly url: string;
  readonly sha256: string;
};

export type Manifest = {
  readonly version: string;
  readonly tag: string;
  readonly releasedAt?: string;
  readonly assets: Partial<Record<TargetLabel, Asset>>;
};

/**
 * Default manifest endpoint; override with `$DEVSTATION_MANIFEST_URL`.
 *
 * GitHub-native: `releases/latest/download/latest.json` follows GitHub's
 * "latest release" redirect to the manifest asset the release workflow
 * uploads — no custom domain or CDN to keep serving. The asset URLs inside
 * are already absolute `github.com/.../releases/download/<tag>/...` links.
 */
export const DEFAULT_MANIFEST_URL =
  "https://github.com/devstationtech/devstation/releases/latest/download/latest.json";

export function manifestUrl(env: Env = denoRuntime.env): string {
  return env.get("DEVSTATION_MANIFEST_URL")?.trim() || DEFAULT_MANIFEST_URL;
}

/** Validates the raw JSON into a `Manifest`, or throws. */
export function parseManifest(raw: unknown): Manifest {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("manifest is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.version !== "string" || !obj.version) {
    throw new Error("manifest.version missing");
  }
  if (typeof obj.assets !== "object" || obj.assets === null) {
    throw new Error("manifest.assets missing");
  }
  const assets: Record<string, Asset> = {};
  for (const [label, value] of Object.entries(obj.assets as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const a = value as Record<string, unknown>;
    if (typeof a.url === "string" && typeof a.sha256 === "string") {
      assets[label] = { url: a.url, sha256: a.sha256 };
    }
  }
  return {
    version: obj.version,
    tag: typeof obj.tag === "string" ? obj.tag : `v${obj.version}`,
    releasedAt: typeof obj.releasedAt === "string" ? obj.releasedAt : undefined,
    assets: assets as Manifest["assets"],
  };
}

/**
 * Fetches + parses the manifest. `signal`/timeout is the caller's job
 * (checkForUpdate races it against a deadline). Any HTTP error throws.
 */
export async function fetchManifest(url: string, signal?: AbortSignal): Promise<Manifest> {
  const res = await fetch(url, { signal, headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status} ${res.statusText}`);
  return parseManifest(await res.json());
}
