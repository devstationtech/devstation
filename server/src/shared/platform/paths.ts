import { join } from "node:path";

/**
 * Per-OS resolution of the user's home directory.
 *
 * Linux/macOS: `$HOME` (POSIX standard, always set).
 * Windows: `$USERPROFILE` (e.g. `C:\Users\Alice`). Some Cygwin/MSYS shells
 *   also export `$HOME` on Windows; we prefer `$USERPROFILE` when running on
 *   Windows for consistency with native tooling expectations.
 *
 * Returns `.` (cwd) as last resort — matches the previous env.ts fallback so
 * tests pointing at tempdirs via `DEVSTATION_HOME` still work without HOME
 * being set.
 */
export function userHome(env: Pick<Deno.Env, "get"> = Deno.env, os = Deno.build.os): string {
  if (os === "windows") {
    return env.get("USERPROFILE") ?? env.get("HOME") ?? ".";
  }
  return env.get("HOME") ?? ".";
}

/**
 * True when this process is the from-source dev build (`deno run …`) rather
 * than a compiled/installed binary. The signal is the executable's basename:
 * `deno` for `deno run`, the output name (`devstation`, `devstation-server-…`)
 * for `deno compile`. Same signal `embedded-server.ts` already trusts to
 * decide whether bundled assets are present.
 */
export function isDevExecutable(execPath = Deno.execPath()): boolean {
  const base = execPath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  return base.startsWith("deno");
}

/**
 * Per-OS default location for DevStation's persisted state when no
 * `DEVSTATION_HOME` override is set.
 *
 * Dev and prod are isolated so the from-source CLI (MCP e2e, possibly-invalid
 * state) never shares a home with the installed binary that drives real
 * infrastructure:
 *   - prod (compiled/installed): `~/devstation`
 *   - dev   (`deno run …`):      `~/devstation-dev`
 * Windows uses `%APPDATA%\devstation[-dev]` (Roaming) when set, else
 * `%USERPROFILE%\.devstation[-dev]`.
 *
 * `DEVSTATION_HOME` overrides this everywhere (tests point it at a tempdir;
 * an operator can pin either home explicitly).
 */
export function defaultDevstationHome(
  env: Pick<Deno.Env, "get"> = Deno.env,
  os = Deno.build.os,
  dev = isDevExecutable(),
): string {
  const name = dev ? "devstation-dev" : "devstation";
  if (os === "windows") {
    const appData = env.get("APPDATA");
    if (appData) return join(appData, name);
    return join(userHome(env, os), `.${name}`);
  }
  return join(userHome(env, os), name);
}
