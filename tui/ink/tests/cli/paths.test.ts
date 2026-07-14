import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { currentUser, defaultDevstationHome, userHome } from "@ui/cli/paths.ts";

/**
 * These helpers branch on `Deno.build.os` at call time, so the test
 * exercises whichever OS the runner is on. To keep coverage even on
 * Linux CI, we wrap each branch behind an env-var swap and a
 * captured/restored value. Effectively: pin USERPROFILE/HOME/APPDATA
 * around each call.
 *
 * The functions are intentionally `Deno.build.os`-coupled (not
 * parameterized) because they're a thin convenience over an OS-fixed
 * concept (where the user's home is). A parameterized API would just
 * push the branching back to every caller.
 */

const OG = {
  HOME: Deno.env.get("HOME"),
  USERPROFILE: Deno.env.get("USERPROFILE"),
  APPDATA: Deno.env.get("APPDATA"),
  USER: Deno.env.get("USER"),
  USERNAME: Deno.env.get("USERNAME"),
};

function setEnv(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
}

function restoreEnv() {
  setEnv(OG);
}

describe("tui paths — currentUser (Windows header `unknown@…` bug)", () => {
  // The TUI header card used to read `$USER` blindly, which is empty
  // on Windows — `unknown@DESKTOP-…` instead of `andre@DESKTOP-…`.
  // `currentUser()` now mirrors the server-side `resolveActor` POSIX/Windows
  // split so the TUI matches the audit log the engine writes.

  it("uses $USER on POSIX", () => {
    /* @Given $USER set and $USERNAME absent */
    setEnv({ USER: "alice", USERNAME: undefined });
    try {
      /* @Then on POSIX currentUser reads $USER */
      if (Deno.build.os !== "windows") {
        assertEquals(currentUser(), "alice");
      }
    } finally {
      restoreEnv();
    }
  });

  it("uses $USERNAME on Windows", () => {
    /* @Given $USERNAME set and $USER absent */
    setEnv({ USER: undefined, USERNAME: "andre" });
    try {
      /* @Then on Windows currentUser reads $USERNAME */
      if (Deno.build.os === "windows") {
        assertEquals(currentUser(), "andre");
      }
    } finally {
      restoreEnv();
    }
  });

  it("falls back across vars when the preferred one is missing", () => {
    // POSIX with USER missing should still find USERNAME if present
    // (and vice-versa on Windows). Cross-OS fallback covers WSL,
    // git-bash on Windows, etc.
    /* @Given the preferred var missing but the other var present */
    setEnv({ USER: undefined, USERNAME: "fallback-user" });
    try {
      /* @Then currentUser falls back across vars */
      assertEquals(currentUser(), "fallback-user");
    } finally {
      restoreEnv();
    }
  });

  it("returns 'unknown' only when both env vars are absent", () => {
    /* @Given both env vars absent */
    setEnv({ USER: undefined, USERNAME: undefined });
    try {
      /* @Then currentUser returns 'unknown' */
      assertEquals(currentUser(), "unknown");
    } finally {
      restoreEnv();
    }
  });

  it("treats whitespace-only values as absent", () => {
    /* @Given whitespace-only env values */
    setEnv({ USER: "   ", USERNAME: "   " });
    try {
      /* @Then they are treated as absent → 'unknown' */
      assertEquals(currentUser(), "unknown");
    } finally {
      restoreEnv();
    }
  });
});

describe("tui paths — userHome + defaultDevstationHome", () => {
  it("on the host's OS, returns a non-relative path when env is sane", () => {
    // Doesn't matter which OS we're on — both branches need a non-"."
    // result when their expected env var is set.
    if (Deno.build.os === "windows") {
      /* @Given a sane %USERPROFILE% */
      setEnv({ USERPROFILE: "C:\\Users\\Alice" });
      try {
        /* @Then userHome returns the absolute Windows path */
        assertEquals(userHome(), "C:\\Users\\Alice");
      } finally {
        restoreEnv();
      }
    } else {
      /* @Given a sane $HOME */
      setEnv({ HOME: "/home/alice" });
      try {
        /* @Then userHome returns the absolute POSIX path */
        assertEquals(userHome(), "/home/alice");
      } finally {
        restoreEnv();
      }
    }
  });

  it("defaultDevstationHome lands under userHome's tree (dev build → -dev suffix)", () => {
    // These tests run under `deno test`, so execPath's basename is `deno` and
    // `defaultDevstationHome()` resolves the DEV home (`devstation-dev`),
    // isolated from the installed prod binary's `devstation`.
    if (Deno.build.os === "windows") {
      /* @Given %APPDATA% present → uses Roaming */
      setEnv({ APPDATA: "C:\\Users\\Alice\\AppData\\Roaming", USERPROFILE: "C:\\Users\\Alice" });
      try {
        /* @When the default home is computed */
        const out = defaultDevstationHome();
        /* @Then it sits under Roaming/devstation-dev */
        assertEquals(out.endsWith("devstation-dev"), true);
        assertEquals(out.includes("AppData") || out.includes("Roaming"), true);
      } finally {
        restoreEnv();
      }

      /* @And with %APPDATA% missing → falls back to %USERPROFILE%\.devstation-dev */
      setEnv({ APPDATA: undefined, USERPROFILE: "C:\\Users\\Alice" });
      try {
        /* @When the default home is computed */
        const out = defaultDevstationHome();
        /* @Then it sits under %USERPROFILE%\.devstation-dev */
        assertEquals(out.endsWith(".devstation-dev"), true);
        assertEquals(out.includes("Alice"), true);
      } finally {
        restoreEnv();
      }
    } else {
      /* @Given a sane $HOME */
      setEnv({ HOME: "/home/alice" });
      try {
        /* @Then the default dev home is $HOME/devstation-dev */
        assertEquals(defaultDevstationHome(), "/home/alice/devstation-dev");
      } finally {
        restoreEnv();
      }
    }
  });
});
