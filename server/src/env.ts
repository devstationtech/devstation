import { dirname, isAbsolute, join, resolve } from "node:path";
import { loadSync } from "@std/dotenv";
import { defaultDevstationHome, userHome } from "@server/shared/platform/paths.ts";

// Best-effort .env load. Local dev typically has a .env at the cwd; the
// installed binary won't, so missing-file errors are swallowed and the
// defaults below kick in.
try {
  loadSync({ export: true });
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}

const env = (name: string, defaultValue: string) => Deno.env.get(name) ?? defaultValue;

/**
 * Resolves a sidecar directory that lives next to the engine binary,
 * with a dev-source fallback when the sidecar isn't present.
 *
 * On Windows the engine binary is extracted into a cache dir
 * (`%LOCALAPPDATA%\devstation\engine-cache\…`), so its own
 * `Deno.execPath()` does NOT point at the sidecar location. The
 * wrapper (`devstation.exe`) propagates `DEVSTATION_SIDECAR_DIR` with
 * its own dirname before spawning the engine, so we prefer that. If
 * unset (dev mode, or running the engine directly), we fall through
 * to `dirname(Deno.execPath())` — and finally to the source path.
 */
function sidecarDefault(sidecarName: string, devSourceRelpath: string): string {
  const wrapperDir = Deno.env.get("DEVSTATION_SIDECAR_DIR");
  if (wrapperDir) {
    try {
      const sidecar = join(wrapperDir, sidecarName);
      Deno.statSync(sidecar);
      return sidecar;
    } catch {
      // wrapper pointer wrong or sidecar missing — fall through
    }
  }
  try {
    const execDir = dirname(Deno.execPath());
    const sidecar = join(execDir, sidecarName);
    Deno.statSync(sidecar);
    return sidecar;
  } catch {
    return devSourceRelpath;
  }
}

const provisioningTemplatesRaw = env(
  "PROVISIONING_TEMPLATES_PATH",
  sidecarDefault(
    "templates",
    "server/src/cluster/outbound/executions/proxmox/provisioning/templates",
  ),
);
const blueprintsRaw = env(
  "BLUEPRINTS_PATH",
  sidecarDefault("blueprints", "blueprints"),
);

// Cross-OS: $HOME on POSIX, $USERPROFILE on Windows. Same "." fallback so
// tests pointing DEVSTATION_HOME at a tempdir still work without HOME set.
export const HOME: string = userHome();

// Single root for everything devstation persists. One knob to override
// (and to isolate per-test by pointing at a tempdir); resources derive
// their own subdirectories under it. Replaces the old per-concern
// CONFIG_PATH/LOGS_PATH pair and the temporary `v2` segment.
//
// Default per OS: ~/.devstation on Linux/macOS; %APPDATA%\devstation on
// Windows (or %USERPROFILE%\.devstation if APPDATA isn't set).
const devstationHomeRaw = env("DEVSTATION_HOME", defaultDevstationHome());
export const DEVSTATION_HOME: string = isAbsolute(devstationHomeRaw)
  ? devstationHomeRaw
  : resolve(Deno.cwd(), devstationHomeRaw);

export const CONFIG_DIR: string = join(DEVSTATION_HOME, "config");
export const LOGS_DIR: string = join(DEVSTATION_HOME, "logs");

export const PROVISIONING_TEMPLATES_PATH: string = isAbsolute(provisioningTemplatesRaw)
  ? provisioningTemplatesRaw
  : resolve(Deno.cwd(), provisioningTemplatesRaw);

export const BLUEPRINTS_PATH: string = isAbsolute(blueprintsRaw)
  ? blueprintsRaw
  : resolve(Deno.cwd(), blueprintsRaw);

// User-local blueprint overlay, merged on top of BLUEPRINTS_PATH — a user's
// blueprint overrides a bundled one of the same name. Default: a `blueprints`
// dir under DEVSTATION_HOME (e.g. ~/.devstation/blueprints). A missing
// directory simply contributes nothing.
const userBlueprintsRaw = env("USER_BLUEPRINTS_PATH", join(DEVSTATION_HOME, "blueprints"));
export const USER_BLUEPRINTS_PATH: string = isAbsolute(userBlueprintsRaw)
  ? userBlueprintsRaw
  : resolve(Deno.cwd(), userBlueprintsRaw);

// --- MCP inbound port -------------------------------------------------
//
// MCP auth is NOT an env var: the server loads its scoped access token
// from `${DEVSTATION_HOME}/mcp/token.json` at boot.
// Configure it via `devstation` → /mcp.
//
// Optional MCP safety policy (default OFF). Grammar lives in McpPolicy.load.
//   DEVSTATION_MCP_POLICY=prefix:ds-e2e-,allow:homelab
export const MCP_POLICY = env("DEVSTATION_MCP_POLICY", "");
