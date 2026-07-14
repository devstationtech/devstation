/**
 * `devstation blueprint register <path> [-f]` — installs a user-authored
 * blueprint into `~/.devstation/blueprints/<name>/`, from where the catalog
 * merges it with the bundled (official) blueprints.
 *
 * The candidate is validated by the **real engine parser** over a public,
 * read-only RPC call (`blueprint.validate`) — no session needed. The engine
 * also reports whether the declared name already exists in the catalog, so we
 * refuse to shadow an existing blueprint unless `--force` is given.
 *
 * File work (copying into the standardized dir) happens here, host-side —
 * same pattern as `mcp install`. No `@server/*` import.
 */
import { basename, join, resolve } from "@std/path";
import { Client, SubprocessCall } from "@jsonrpc-client-ts/mod.ts";
import type { BlueprintValidateResponse } from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import { defaultDevstationHome } from "@ui/cli/paths.ts";
import { resolveEngineCommand } from "@ui/embedded-server.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { fs, env, process } = denoRuntime;

export type Validation = BlueprintValidateResponse;

/** Seams so the branching is unit-testable without spawning the engine or disk. */
export interface RegisterDeps {
  /** Validate a candidate blueprint at `absPath` via the engine parser. */
  validate(absPath: string): Promise<Validation>;
  /** Destination root for user blueprints (default `~/.devstation/blueprints`). */
  userBlueprintsDir(): string;
  /** Recursively copy the blueprint's source directory into `dest`. */
  copyDir(src: string, dest: string): Promise<void>;
}

/** `~/.devstation/blueprints` (honors DEVSTATION_HOME). */
export function userBlueprintsDir(): string {
  const home = env.get("DEVSTATION_HOME") ?? defaultDevstationHome();
  return join(home, "blueprints");
}

/** Validate a candidate via a one-shot, public RPC call to the engine. */
export async function engineValidate(absPath: string): Promise<Validation> {
  const { command, args } = await resolveEngineCommand();
  const channel = new SubprocessCall(command, args, process.spawnChannel);
  const rpc = new Client(channel);
  try {
    return await rpc.invoke<BlueprintValidateResponse>("blueprint.validate", { path: absPath });
  } finally {
    await channel.shutdown();
  }
}

/** Recursively copy `src` → `dest` using the runtime facade. */
export async function copyDirWith(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  for (const entry of fs.readDirSync(src)) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory) await copyDirWith(from, to);
    else await fs.copyFile(from, to);
  }
}

export const defaultDeps: RegisterDeps = {
  validate: engineValidate,
  userBlueprintsDir,
  copyDir: copyDirWith,
};

export type RegisterResult = { ok: boolean; message: string };

/**
 * Registers the blueprint whose directory (or `blueprint.yaml`) is at
 * `sourcePath`. Returns a human message; never throws for expected failures
 * (invalid blueprint, name collision) — the CLI turns `ok:false` into exit 1.
 */
export async function registerBlueprint(
  sourcePath: string,
  opts: { force?: boolean },
  deps: RegisterDeps = defaultDeps,
): Promise<RegisterResult> {
  const abs = resolve(sourcePath);
  // The blueprint dir is `abs` itself, or the parent when a file was passed.
  const isYaml = /\.ya?ml$/i.test(abs);
  const sourceDir = isYaml ? abs.slice(0, abs.length - basename(abs).length - 1) : abs;

  const v = await deps.validate(abs);
  if (!v.valid || !v.name) {
    return { ok: false, message: `Invalid blueprint: ${v.error ?? "unknown error"}` };
  }
  if (v.existing && !opts.force) {
    return {
      ok: false,
      message: `A blueprint named "${v.name}" already exists (${v.existing}). ` +
        `Re-run with --force to override it with your local copy.`,
    };
  }

  const dest = join(deps.userBlueprintsDir(), v.name);
  await deps.copyDir(sourceDir, dest);

  const suffix = v.existing ? ` (overrides the ${v.existing} one)` : "";
  return { ok: true, message: `Registered blueprint "${v.name}" → ${dest}${suffix}` };
}
