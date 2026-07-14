/**
 * chalk-flavoured colorisers that follow the active theme. Use these
 * from non-React code paths (utility functions, string composition for
 * Ink children) where calling `useTheme()` isn't possible.
 *
 * Why not just import `chalk` directly: a literal `chalk.gray(...)`
 * collapses into invisible faint text on a white terminal background.
 * Going through the theme keeps the call site terse while letting
 * `setTheme("light")` swap the underlying chalk method to
 * `chalk.blackBright` (a visible darker gray on light bg).
 */
import chalk from "chalk";
import { getTheme } from "@ui/shared/theme/theme.ts";

type ChalkFn = (s: string) => string;

const DARK_DIM: ChalkFn = chalk.gray;
const LIGHT_DIM: ChalkFn = chalk.blackBright;

/** Dim/muted text — secondary info, hints, faded metadata. */
export function dimText(s: string): string {
  return getTheme().mode === "light" ? LIGHT_DIM(s) : DARK_DIM(s);
}

/** Alias of `dimText` for readability at the call site. */
export const mutedText = dimText;
