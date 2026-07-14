import { DenoReleaseAdapter } from "./deno-adapter.ts";

const adapter = new DenoReleaseAdapter();

function hasFlag(name: string) {
  return adapter.args.includes(`--${name}`);
}

function normalizeVersion(version: string) {
  return version.replace(/^v/, "");
}

function assertReleaseVersion(version: string) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`deno.json version must be a stable SemVer X.Y.Z value. Received: ${version}`);
  }
}

async function readVersion() {
  const denoJson = await adapter.readJson<{ version?: string }>("deno.json");
  const version = normalizeVersion(denoJson.version ?? "");
  assertReleaseVersion(version);
  return version;
}

async function tagExists(tag: string) {
  const tagSha = await adapter.commandOutput("git", [
    "rev-parse",
    "-q",
    "--verify",
    `refs/tags/${tag}`,
  ]);
  return Boolean(tagSha);
}

const version = await readVersion();
const tag = `v${version}`;
const shouldRelease = !(await tagExists(tag));

if (hasFlag("github-output")) {
  const outputPath = adapter.env("GITHUB_OUTPUT");
  if (!outputPath) throw new Error("GITHUB_OUTPUT is not set");
  await adapter.appendTextFile(
    outputPath,
    [
      `version=${version}`,
      `tag=${tag}`,
      `should_release=${shouldRelease ? "true" : "false"}`,
      "",
    ].join("\n"),
  );
  console.log(
    shouldRelease
      ? `Release ${tag} will be created.`
      : `Release ${tag} already exists; skipping publish.`,
  );
} else if (hasFlag("tag")) {
  console.log(tag);
} else {
  console.log(version);
}
