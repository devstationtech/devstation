import { join } from "node:path";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { env } = denoRuntime;

/**
 * Per-OS home + DevStation home resolution for the UI binary. Mirrors
 * the engine-side `server/src/shared/platform/paths.ts` — duplicated
 * here on purpose to preserve the zero-coupling invariant
 * (`tui/ink/src/** toNotImport server/src/**`). ~20 lines; cheaper
 * than promoting platform helpers into a shared lib.
 *
 * OS + env access go through the platform runtime facade (the single
 * `Deno.*` seam), so the UI stays portable to Bun/Node.
 *
 * Windows ($HOME undefined) was the bug: token path resolved to the
 * relative ".devstation/mcp/token.json" and the install advisory
 * complained about a missing token that actually existed under
 * %APPDATA%\devstation\mcp\token.json.
 */
export function userHome(): string {
  if (env.os === "windows") {
    return env.get("USERPROFILE") ?? env.get("HOME") ?? ".";
  }
  return env.get("HOME") ?? ".";
}

/**
 * True when the UI is the from-source dev build (`deno run …`) rather than a
 * compiled/installed binary. Basename of the executable: `deno` for dev, the
 * output name for `deno compile`. Mirrors the engine-side `isDevExecutable`.
 */
export function isDevExecutable(): boolean {
  try {
    const base = env.execPath().split(/[\\/]/).pop()?.toLowerCase() ?? "";
    return base.startsWith("deno");
  } catch {
    return false;
  }
}

/**
 * Default DevStation home, isolated per build so the from-source CLI never
 * shares state with the installed binary:
 *   - prod (compiled/installed): `~/devstation`
 *   - dev   (`deno run …`):      `~/devstation-dev`
 * `DEVSTATION_HOME` overrides this everywhere.
 */
export function defaultDevstationHome(): string {
  const name = isDevExecutable() ? "devstation-dev" : "devstation";
  if (env.os === "windows") {
    const appData = env.get("APPDATA");
    if (appData) return join(appData, name);
    return join(userHome(), `.${name}`);
  }
  return join(userHome(), name);
}

/**
 * The OS user displayed in the TUI header and stamped on UI-side
 * `creation.by` (vault.secret.generate from the form, etc.).
 * Mirrors the server-side `resolveActor()` — POSIX uses `$USER`,
 * Windows uses `$USERNAME`, fallback is `"unknown"`.
 *
 * Before this helper, the TUI just read `$USER`, so on Windows the
 * header showed `unknown@<host>` because `$USER` is not set there.
 */
export function currentUser(): string {
  try {
    const candidate = env.os === "windows"
      ? (env.get("USERNAME") ?? env.get("USER"))
      : (env.get("USER") ?? env.get("USERNAME"));
    const trimmed = candidate?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * The host machine's network name, used as the default `hostname` in
 * registration forms and in the TUI header. Falls back to `"unknown"`
 * when the host name can't be read. Centralized here so the 9 forms
 * that need a default host don't each reach for the runtime.
 */
export function currentHost(): string {
  try {
    return env.hostname();
  } catch {
    return "unknown";
  }
}
