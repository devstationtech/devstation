/**
 * Pre-mount theme decision for the TUI.
 *
 * Default behaviour: **lock the TUI to dark mode AND paint the
 * terminal background dark while the TUI runs** via OSC 11. The
 * wrapper restores the original background on exit. This is the same
 * trick btop and similar full-screen TUIs use — it guarantees a
 * consistent look regardless of the underlying terminal theme (so the
 * `inverse` highlight bars, status chips, and dim text all read the
 * same way on Terminal.app/Warp/iTerm2/Linux Warp/Windows terminal).
 *
 * `$DEVSTATION_THEME` controls the policy:
 *
 *   unset OR `dark`  → mode=dark, forceDark=true (the new default).
 *                      Caller emits OSC 11 to set a dark terminal bg.
 *   `light`          → mode=light, forceDark=false. Caller skips OSC 11
 *                      so the user's terminal theme is preserved.
 *   `auto`           → mode is detected (COLORFGBG → OSC 11 query →
 *                      default dark), forceDark=false. Original
 *                      "follow the terminal" behaviour, kept as an
 *                      opt-in for users who customise their setup and
 *                      don't want the wrapper repainting their bg.
 *
 * Detection chain (used only by `auto`):
 *   1. `$COLORFGBG` env (iTerm2, konsole, urxvt, WezTerm).
 *   2. OSC 11 query (`\x1b]11;?\x07`) — Terminal.app and Warp reply
 *      here. Times out at ~120ms.
 *   3. Default `dark`.
 *
 * Called from `tui/ink/bin/devstation` BEFORE Ink mounts, because Ink
 * takes over stdin and the OSC 11 query needs raw stdin access for a
 * brief window.
 */

import { setTheme, type ThemeMode } from "@ui/shared/theme/theme.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { env, terminal } = denoRuntime;

const OSC_TIMEOUT_MS = 120;

/**
 * Default hex bg the wrapper paints onto the terminal when
 * `forceDark` is true. Overridable via `$DEVSTATION_BACKGROUND` for
 * the rare user who wants a different shade (pure black, brand colour,
 * etc). `#1e1e1e` matches the VS Code "Dark+" backdrop and plays
 * nicely with the dark-theme chip / border palette.
 */
export const DEFAULT_FORCED_BG = "#1e1e1e";

export type ThemeDecision = {
  /** Theme tokens applied to the singleton — what `getTheme()` returns. */
  readonly mode: ThemeMode;
  /**
   * True when the wrapper should paint the terminal background dark
   * via OSC 11 for the lifetime of the TUI and restore it on exit.
   */
  readonly forceDark: boolean;
  /** Hex bg colour to paint when `forceDark` is true. */
  readonly forcedBackground: string;
};

/**
 * Resolves the theme decision, applies the mode to the singleton, and
 * returns the full decision so the caller (`bin/devstation`) can act
 * on `forceDark` / `forcedBackground`.
 */
export async function detectTheme(): Promise<ThemeDecision> {
  const decision = await resolveDecision();
  setTheme(decision.mode);
  return decision;
}

async function resolveDecision(): Promise<ThemeDecision> {
  const override = env.get("DEVSTATION_THEME")?.trim().toLowerCase();
  const forcedBackground = env.get("DEVSTATION_BACKGROUND")?.trim() || DEFAULT_FORCED_BG;

  if (override === "light") {
    return { mode: "light", forceDark: false, forcedBackground };
  }
  if (override === "auto") {
    const mode = await autoDetect();
    return { mode, forceDark: false, forcedBackground };
  }
  // `dark` or unset (or any unknown value) → default: force dark.
  return { mode: "dark", forceDark: true, forcedBackground };
}

async function autoDetect(): Promise<ThemeMode> {
  const fromEnv = parseColorFgBg(env.get("COLORFGBG"));
  if (fromEnv) return fromEnv;

  const fromQuery = await queryBackgroundColor();
  if (fromQuery) return fromQuery;

  return "dark";
}

/**
 * Parses the `COLORFGBG` env var. Format is `<fg>;<bg>` (some shells
 * insert a `default` segment, so we always take the LAST numeric token).
 * ANSI colour indexes 0–7 are dark, 8–15 are bright. By convention bg
 * >= 7 (light gray or white) is treated as a light background.
 */
export function parseColorFgBg(raw: string | undefined): ThemeMode | null {
  if (!raw) return null;
  const tokens = raw.split(";").map((t) => t.trim());
  const last = tokens[tokens.length - 1];
  const n = Number.parseInt(last, 10);
  if (Number.isNaN(n)) return null;
  return n >= 7 ? "light" : "dark";
}

async function queryBackgroundColor(): Promise<ThemeMode | null> {
  // Only safe to do if both ends are a TTY. CI, pipes, etc. would
  // never reply and we'd just burn the timeout for nothing.
  try {
    if (!terminal.stdinIsTerminal() || !terminal.stdoutIsTerminal()) return null;
  } catch {
    return null;
  }

  let rawSet = false;
  try {
    terminal.setRawStdin(true);
    rawSet = true;
    const encoder = new TextEncoder();
    await terminal.writeStdout(encoder.encode("\x1b]11;?\x07"));

    const reply = await readWithTimeout(OSC_TIMEOUT_MS);
    if (!reply) return null;

    return classifyOsc11(reply);
  } catch {
    return null;
  } finally {
    if (rawSet) {
      try {
        terminal.setRawStdin(false);
      } catch { /* terminal might be gone; nothing else to do */ }
    }
  }
}

function readWithTimeout(ms: number): Promise<string | null> {
  const buf = new Uint8Array(64);
  const readPromise = terminal.readStdin(buf).then((n) =>
    n === null ? null : new TextDecoder().decode(buf.subarray(0, n))
  );
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), ms);
  });
  return Promise.race([readPromise, timeoutPromise]);
}

/**
 * Parses an OSC 11 reply of the form
 *   `\x1b]11;rgb:RRRR/GGGG/BBBB\x07` (or `\x1b\\` terminator)
 * and classifies the colour as light or dark by perceived luminance.
 *
 * Some terminals reply with 8-bit (`rgb:RR/GG/BB`) instead of 16-bit;
 * the regex handles both.
 */
export function classifyOsc11(reply: string): ThemeMode | null {
  const match = reply.match(/rgb:([0-9a-f]+)\/([0-9a-f]+)\/([0-9a-f]+)/i);
  if (!match) return null;
  const [r, g, b] = match.slice(1, 4).map(parseHexComponent);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  // Rec. 709 luma. >= 0.5 → light (perceived bright background).
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma >= 0.5 ? "light" : "dark";
}

function parseHexComponent(hex: string): number {
  // Normalize 16-bit (4-char) → 8-bit (2-char) by taking the upper byte.
  const trimmed = hex.length > 2 ? hex.slice(0, 2) : hex;
  return Number.parseInt(trimmed, 16);
}
