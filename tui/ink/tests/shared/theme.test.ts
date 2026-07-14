import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import chalk from "chalk";
import {
  classifyOsc11,
  DEFAULT_FORCED_BG,
  detectTheme,
  parseColorFgBg,
} from "@ui/shared/theme/detect.ts";
import { getTheme, setTheme } from "@ui/shared/theme/theme.ts";
import { dimText } from "@ui/shared/theme/colorize.ts";

// Force chalk to emit ANSI in the test harness — chalk auto-detects
// (no TTY → no colors) and we need the escape codes to assert on.
chalk.level = 1;

function withEnv(vars: Record<string, string | undefined>): () => void {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  return () => {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  };
}

describe("parseColorFgBg", () => {
  it("returns null for missing/empty input", () => {
    /* @Then missing/empty input returns null */
    assertEquals(parseColorFgBg(undefined), null);
    assertEquals(parseColorFgBg(""), null);
  });

  it("classifies dark backgrounds as dark (bg < 7)", () => {
    /* @Then a bg index < 7 classifies as dark */
    assertEquals(parseColorFgBg("15;0"), "dark"); // white on black
    assertEquals(parseColorFgBg("7;0"), "dark");
    assertEquals(parseColorFgBg("default;1"), "dark"); // red bg, conservative dark
    assertEquals(parseColorFgBg("15;6"), "dark");
  });

  it("classifies light backgrounds as light (bg >= 7)", () => {
    /* @Then a bg index >= 7 classifies as light */
    assertEquals(parseColorFgBg("0;15"), "light"); // black on white
    assertEquals(parseColorFgBg("0;7"), "light"); // black on light gray
    assertEquals(parseColorFgBg("default;default;15"), "light");
  });

  it("returns null when the last token isn't numeric", () => {
    /* @Then a non-numeric last token returns null */
    assertEquals(parseColorFgBg("15;default"), null);
    assertEquals(parseColorFgBg("xyz"), null);
  });
});

describe("classifyOsc11", () => {
  it("classifies the standard dark-bg reply as dark", () => {
    /* @Then a dark-bg OSC 11 reply classifies as dark */
    // iTerm2 default dark bg: ~rgb:1e1e/1e1e/1e1e → luma ~0.12 → dark
    assertEquals(classifyOsc11("\x1b]11;rgb:1e1e/1e1e/1e1e\x07"), "dark");
  });

  it("classifies the standard light-bg reply as light", () => {
    /* @Then a light-bg OSC 11 reply classifies as light */
    // Terminal.app default light bg: ~rgb:ffff/ffff/ffff → luma 1.0 → light
    assertEquals(classifyOsc11("\x1b]11;rgb:ffff/ffff/ffff\x07"), "light");
  });

  it("accepts 8-bit (2-char) component encoding too", () => {
    /* @Then 8-bit (2-char) component encoding is also classified */
    // Some terminals reply with `rgb:ff/ff/ff` instead of the 16-bit form
    assertEquals(classifyOsc11("\x1b]11;rgb:ff/ff/ff\x07"), "light");
    assertEquals(classifyOsc11("\x1b]11;rgb:00/00/00\x07"), "dark");
  });

  it("falls back to luma threshold near the middle", () => {
    /* @Then near the 0.5 luma boundary it falls to the threshold */
    // Mid-gray bg — rare but should classify; 0.5 is the boundary, slightly
    // brighter should be light, slightly darker should be dark
    assertEquals(classifyOsc11("\x1b]11;rgb:8888/8888/8888\x07"), "light");
    assertEquals(classifyOsc11("\x1b]11;rgb:7000/7000/7000\x07"), "dark");
  });

  it("returns null for non-OSC-11 replies", () => {
    /* @Then non-OSC-11 replies return null */
    assertEquals(classifyOsc11("garbage"), null);
    assertEquals(classifyOsc11("\x1b]11;notrgb:foo\x07"), null);
  });
});

describe("theme singleton", () => {
  it("defaults to dark mode tokens before setTheme is called", () => {
    /* @Given the theme set to dark */
    setTheme("dark");
    /* @When the singleton is read */
    const t = getTheme();
    /* @Then it yields dark-mode tokens */
    assertEquals(t.mode, "dark");
    assertEquals(t.dim, "gray");
    assertEquals(t.primary, "cyan");
  });

  it('flips to light mode tokens after setTheme("light")', () => {
    /* @Given the theme set to light */
    setTheme("light");
    /* @When the singleton is read */
    const t = getTheme();
    /* @Then it yields light-mode tokens */
    assertEquals(t.mode, "light");
    // blackBright reads on white; gray would be invisible
    assertEquals(t.dim, "blackBright");
    assertEquals(t.primary, "blue");

    setTheme("dark"); // restore for other tests
  });
});

describe("dimText", () => {
  it("uses chalk.gray for dark mode", () => {
    /* @Given dark mode */
    setTheme("dark");
    /* @When text is dimmed */
    const out = dimText("hello");
    /* @Then it wraps the text in chalk.gray (ANSI 90) */
    // chalk.gray emits ANSI `\x1b[90m...\x1b[39m`
    assertEquals(out.includes("hello"), true);
    assertEquals(out.includes("\x1b[90m"), true);
  });

  it("uses chalk.blackBright for light mode (same ANSI 90, different intent)", () => {
    /* @Given light mode */
    setTheme("light");
    /* @When text is dimmed */
    const out = dimText("hello");
    /* @Then it wraps the text in chalk.blackBright (same ANSI 90) */
    assertEquals(out.includes("hello"), true);
    // chalk.blackBright also emits ANSI 90 — they're the same code in chalk
    assertEquals(out.includes("\x1b[90m"), true);

    setTheme("dark"); // restore
  });
});

describe("detectTheme — decision policy", () => {
  it("default (env unset) → dark + forceDark, default bg", async () => {
    /* @Given the theme/background env unset */
    const restore = withEnv({ DEVSTATION_THEME: undefined, DEVSTATION_BACKGROUND: undefined });
    try {
      /* @When the theme is detected */
      const d = await detectTheme();
      /* @Then it defaults to dark with forceDark and the default bg */
      assertEquals(d.mode, "dark");
      assertEquals(d.forceDark, true);
      assertEquals(d.forcedBackground, DEFAULT_FORCED_BG);
    } finally {
      restore();
    }
  });

  it("DEVSTATION_THEME=dark → same as default (forceDark on)", async () => {
    /* @Given DEVSTATION_THEME=dark */
    const restore = withEnv({ DEVSTATION_THEME: "dark", DEVSTATION_BACKGROUND: undefined });
    try {
      /* @When the theme is detected */
      const d = await detectTheme();
      /* @Then it behaves like the default (dark + forceDark) */
      assertEquals(d.mode, "dark");
      assertEquals(d.forceDark, true);
    } finally {
      restore();
    }
  });

  it("DEVSTATION_THEME=light → light tokens, forceDark OFF (terminal bg preserved)", async () => {
    /* @Given DEVSTATION_THEME=light */
    const restore = withEnv({ DEVSTATION_THEME: "light" });
    try {
      /* @When the theme is detected */
      const d = await detectTheme();
      /* @Then light tokens with forceDark off (terminal bg preserved) */
      assertEquals(d.mode, "light");
      assertEquals(d.forceDark, false);
    } finally {
      restore();
    }
  });

  it("DEVSTATION_THEME=auto + COLORFGBG light → light tokens, forceDark OFF", async () => {
    /* @Given DEVSTATION_THEME=auto with a light COLORFGBG */
    const restore = withEnv({ DEVSTATION_THEME: "auto", COLORFGBG: "0;15" });
    try {
      /* @When the theme is detected */
      const d = await detectTheme();
      /* @Then light tokens with forceDark off */
      assertEquals(d.mode, "light");
      assertEquals(d.forceDark, false);
    } finally {
      restore();
    }
  });

  it("DEVSTATION_THEME=auto + COLORFGBG dark → dark tokens, forceDark still OFF", async () => {
    /* @Given DEVSTATION_THEME=auto with a dark COLORFGBG */
    const restore = withEnv({ DEVSTATION_THEME: "auto", COLORFGBG: "15;0" });
    try {
      /* @When the theme is detected */
      const d = await detectTheme();
      /* @Then dark tokens but forceDark stays off */
      assertEquals(d.mode, "dark");
      assertEquals(d.forceDark, false);
    } finally {
      restore();
    }
  });

  it("DEVSTATION_BACKGROUND overrides the forced bg shade", async () => {
    /* @Given DEVSTATION_BACKGROUND overriding the forced bg shade */
    const restore = withEnv({
      DEVSTATION_THEME: undefined,
      DEVSTATION_BACKGROUND: "#000000",
    });
    try {
      /* @When the theme is detected */
      const d = await detectTheme();
      /* @Then forceDark stays on and the forced bg uses the override */
      assertEquals(d.forceDark, true);
      assertEquals(d.forcedBackground, "#000000");
    } finally {
      restore();
    }
  });

  it("unknown DEVSTATION_THEME values fall through to default (force dark)", async () => {
    /* @Given an unknown DEVSTATION_THEME value */
    const restore = withEnv({ DEVSTATION_THEME: "rainbow" });
    try {
      /* @When the theme is detected */
      const d = await detectTheme();
      /* @Then it falls through to the default (dark + forceDark) */
      assertEquals(d.mode, "dark");
      assertEquals(d.forceDark, true);
    } finally {
      restore();
    }
  });
});
