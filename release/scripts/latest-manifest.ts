import { DenoReleaseAdapter } from "./deno-adapter.ts";

const adapter = new DenoReleaseAdapter();
const DIST_DIR = "dist";

type AssetSpec = {
  /** Label used in latest.json under `assets[label]`. */
  label: string;
  /** File name in dist/checksums.txt — also the asset name on the GitHub release. */
  asset: string;
};

// Mirror of the platforms `build-release.ts` produces. Adding a target
// means adding the matching entry here and in checksums.ts so the
// manifest installer can read its URL + sha.
const ASSETS: AssetSpec[] = [
  { label: "linux-x64", asset: "devstation-linux-x64.tar.gz" },
  { label: "darwin-x64", asset: "devstation-darwin-x64.tar.gz" },
  { label: "darwin-arm64", asset: "devstation-darwin-arm64.tar.gz" },
  { label: "windows-x64", asset: "devstation-windows-x64.zip" },
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
  const version = denoJson.version;
  if (!version) throw new Error("deno.json must define a version");
  return version;
}

function checksumFor(checksums: string, assetName: string): string | null {
  for (const line of checksums.split("\n")) {
    const [sha256, fileName] = line.trim().split(/\s+/);
    if (fileName === assetName) return sha256;
  }
  return null;
}

const version = readOption("version") ?? await readDenoVersion();
const tag = readOption("tag") ?? `v${version.replace(/^v/, "")}`;
const repository = readOption("repository", adapter.env("GITHUB_REPOSITORY"));

if (!repository) {
  throw new Error("Missing repository. Pass --repository or set GITHUB_REPOSITORY.");
}

const checksums = await adapter.readTextFile(adapter.join(DIST_DIR, "checksums.txt"));

// Skip assets that aren't present in checksums.txt — supports partial
// releases (e.g. CI fan-out where one OS runner failed and we want the
// other three published anyway).
const assets: Record<string, { url: string; sha256: string }> = {};
for (const { label, asset } of ASSETS) {
  const sha256 = checksumFor(checksums, asset);
  if (!sha256) {
    console.warn(`skipping ${label}: ${asset} missing from checksums.txt`);
    continue;
  }
  assets[label] = {
    url: `https://github.com/${repository}/releases/download/${tag}/${asset}`,
    sha256,
  };
}

if (Object.keys(assets).length === 0) {
  throw new Error("No assets resolved — checksums.txt empty or no expected files matched.");
}

const manifest = {
  version: version.replace(/^v/, ""),
  tag,
  releasedAt: readOption("released-at") ?? adapter.nowIso(),
  assets,
};

await adapter.writeTextFile(
  adapter.join(DIST_DIR, "latest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `Wrote ${adapter.join(DIST_DIR, "latest.json")} for ${tag} (${
    Object.keys(assets).length
  } assets)`,
);
