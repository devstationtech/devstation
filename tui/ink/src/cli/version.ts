/**
 * UI build metadata — owned by the Ink TUI binary, not the engine.
 *
 * The release script rewrites these constants per binary at compile
 * time, same mechanism `server/src/build-info.ts` uses for the engine.
 * Keeping them separate keeps `tui/ink/` independent of `server/`.
 */
export const VERSION = "0.1.0";
export const GIT_SHA = "dev";
export const BUILD_DATE = "dev";
