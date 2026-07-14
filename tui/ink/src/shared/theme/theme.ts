/**
 * Theme tokens for the TUI. Two presets — `dark` and `light` — model
 * the two terminal-background classes we have to render against. Each
 * token holds a string that's safe to pass to both Ink's `<Text color>`
 * prop and chalk's `chalk.keyword(...)` lookup (i.e. an ANSI palette
 * keyword like "gray", "blackBright", "cyan").
 *
 * The current theme is held in a module-level singleton, set once at
 * boot via `setTheme(mode)` after `detectTheme()` resolves. Components
 * read it via `useTheme()` (React) or `getTheme()` (utility code that
 * runs outside the render tree, e.g. chalk-based string composition).
 *
 * Why `blackBright` in light mode instead of plain `gray`: on a white
 * terminal background, `gray` and `dim` collapse into faint near-white
 * text that's effectively invisible. `blackBright` is the ANSI bright-
 * black slot (#555-ish) which terminals render as a legible darker
 * gray on light backgrounds and as a slightly brighter gray on dark
 * backgrounds.
 */

export type ThemeMode = "light" | "dark";

export type Theme = {
  readonly mode: ThemeMode;
  /** Subdued explanatory text (hints, secondary metadata). */
  readonly dim: string;
  /** Same intent as `dim`; kept as an alias for places that read better. */
  readonly muted: string;
  /** Accent color used for headings, focused borders, etc. */
  readonly primary: string;
  /** Color for box borders / dividers that should recede. */
  readonly border: string;
  /** Title chip backgrounds (titled-box header label, etc.). */
  readonly chipBackground: string;
  /** Title chip foreground — must contrast against `chipBackground`. */
  readonly chipForeground: string;
  /** Status palette — intentionally constant across modes (red is red, etc.). */
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
};

const DARK: Theme = {
  mode: "dark",
  dim: "gray",
  muted: "gray",
  primary: "cyan",
  border: "#666666",
  chipBackground: "#323232",
  chipForeground: "#aeaeae",
  success: "green",
  warning: "yellow",
  danger: "red",
};

const LIGHT: Theme = {
  mode: "light",
  // `blackBright` (ANSI 90) renders as a darker gray that survives a
  // white terminal background — `gray` would be near-white and invisible.
  dim: "blackBright",
  muted: "blackBright",
  // `blue` reads better than `cyan` on white; cyan is washed out.
  primary: "blue",
  border: "#888888",
  // Inverted chip palette: light-gray pill with dark text reads cleanly
  // on a white terminal without looking like a black sticker pasted on.
  chipBackground: "#dddddd",
  chipForeground: "#323232",
  success: "green",
  warning: "yellow",
  danger: "red",
};

export const THEMES: Record<ThemeMode, Theme> = { dark: DARK, light: LIGHT };

let current: Theme = DARK;

/** Replace the active theme. Call once after `detectTheme()` resolves. */
export function setTheme(mode: ThemeMode): void {
  current = THEMES[mode];
}

/**
 * Read the active theme from any context. Stable across renders — the
 * singleton only flips when `setTheme()` is called. React components
 * should still prefer `useTheme()` so they re-render if we ever support
 * live theme switching.
 */
export function getTheme(): Theme {
  return current;
}
