/**
 * SemVer-lite value object + target detection for self-update.
 *
 * We don't pull a SemVer lib: the manifest only ever carries plain
 * `X.Y.Z` release versions, so a 3-number compare is enough. Dev/CI
 * builds (`0.0.0`, anything with a pre-release dash, or the literal
 * `dev`) are detected so the update check can short-circuit — a dev
 * binary should never nag about "updates".
 */
import { type ArchKind, denoRuntime, type OsKind } from "@ui/shared/platform/mod.ts";

export type TargetLabel =
  | "linux-x64"
  | "darwin-x64"
  | "darwin-arm64"
  | "windows-x64";

/** Parsed `X.Y.Z` triple, or null when the string isn't a clean release. */
function parse(version: string): [number, number, number] | null {
  const m = version.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Returns -1 / 0 / 1 for a<b / a==b / a>b. Unparseable inputs sort as
 * "older" so a dev `current` never appears newer than a real `latest`.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

export class Version {
  constructor(readonly value: string) {}

  /** A build that should never be told to update (local/dev/CI). */
  isDev(): boolean {
    const v = this.value.trim();
    if (v === "" || v === "dev") return true;
    if (v.startsWith("0.0.0")) return true;
    // Pre-release / build-metadata (`-`, `+`) → treat as non-release.
    if (/[-+]/.test(v.replace(/^v/, ""))) return true;
    return parse(v) === null;
  }

  isNewerThan(other: Version): boolean {
    return compareSemver(this.value, other.value) === 1;
  }

  equals(other: Version): boolean {
    return compareSemver(this.value, other.value) === 0;
  }
}

/**
 * Maps the running platform to the release asset label. Returns null
 * for combos we don't publish (e.g. linux-arm64), so callers can skip
 * the update flow gracefully instead of fetching a non-existent asset.
 */
export function currentTarget(
  os: OsKind = denoRuntime.env.os,
  arch: ArchKind = denoRuntime.env.arch,
): TargetLabel | null {
  if (os === "linux" && arch === "x86_64") return "linux-x64";
  if (os === "darwin" && arch === "x86_64") return "darwin-x64";
  if (os === "darwin" && arch === "aarch64") return "darwin-arm64";
  if (os === "windows" && arch === "x86_64") return "windows-x64";
  return null;
}
