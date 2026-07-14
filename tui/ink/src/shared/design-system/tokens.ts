/**
 * Design tokens for the TUI. Mode-stable intents (success/danger/etc.)
 * stay as constants — red is red on any background — but anything that
 * has to recede (muted text, accents, borders) goes through the active
 * theme via getters so light terminals get legible contrast.
 *
 * Components reading these objects pay the lookup cost at render time
 * (one method call per token), after `detectTheme()` has resolved.
 */
import { getTheme } from "@ui/shared/theme/theme.ts";

export type Intent = "success" | "warning" | "danger" | "info";

/**
 * Stable status palette — does NOT vary by theme. ANSI red/yellow/green
 * render fine on both dark and light backgrounds.
 *
 * Theme-aware tokens (primary/accent/muted) are exposed as getters and
 * resolve through `getTheme()` at access time.
 */
export const colors = {
  success: "green",
  danger: "red",
  warning: "yellow",
  get primary(): string {
    return getTheme().primary;
  },
  get accent(): string {
    return getTheme().primary;
  },
  get muted(): string {
    return getTheme().muted;
  },
} as const;

export const intentColor = {
  success: "green",
  warning: "yellow",
  danger: "red",
  get info(): string {
    return getTheme().primary;
  },
} as Record<Intent, string>;

export const spinner = {
  type: "dots" as const,
  get color(): string {
    return getTheme().primary;
  },
};

export const textInput = {
  showCursor: true,
};

export const table = {
  cellPadding: 2,
  get focusColor(): string {
    return getTheme().primary;
  },
  headerBold: true,
  get borderColor(): string {
    return getTheme().border;
  },
  separatorChar: "─",
};
