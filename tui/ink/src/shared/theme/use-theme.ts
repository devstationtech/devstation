/**
 * React hook returning the active theme. Reads the singleton on every
 * render — so a `setTheme()` invocation outside the render tree is
 * picked up on the next re-render (we don't currently have a live-
 * switch path, but the hook is stable in case we add one).
 */
import { getTheme, type Theme } from "@ui/shared/theme/theme.ts";

export function useTheme(): Theme {
  return getTheme();
}
