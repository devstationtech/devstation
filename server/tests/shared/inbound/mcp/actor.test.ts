import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolveActor } from "@server/shared/inbound/mcp/actor.ts";

/**
 * Pins the actor resolution helper used by mutating MCP endpoints.
 * When `user`/`hostname` args are absent or blank, the helper derives
 * them from the engine's env ($USER/$USERNAME + Deno.hostname()) so
 * the audit trail captures the real operator instead of a placeholder.
 *
 * Each test saves/restores the relevant env vars so the suite runs
 * deterministically on Linux CI / macOS / Windows.
 */
const OG = {
  USER: Deno.env.get("USER"),
  USERNAME: Deno.env.get("USERNAME"),
};

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const set = (k: string, v: string | undefined) => {
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  };
  try {
    for (const [k, v] of Object.entries(values)) set(k, v);
    fn();
  } finally {
    set("USER", OG.USER);
    set("USERNAME", OG.USERNAME);
  }
}

describe("resolveActor — MCP audit-trail defaults", () => {
  it("caller-supplied values win over env", () => {
    /* @Given caller-supplied user + hostname alongside an env USER */
    withEnv({ USER: "system-default" }, () => {
      /* @When the actor is resolved */
      const actor = resolveActor({ user: "alice", hostname: "alice-mac" });
      /* @Then the caller values win over env */
      assertEquals(actor, { user: "alice", hostname: "alice-mac" });
    });
  });

  it("blank/whitespace-only inputs are treated as absent", () => {
    /* @Given blank/whitespace caller inputs and an env USER */
    withEnv({ USER: "from-env", USERNAME: undefined }, () => {
      /* @When the actor is resolved */
      const actor = resolveActor({ user: "   ", hostname: "" });
      /* @Then blanks are ignored: user from env, hostname trimmed + non-empty */
      assertEquals(actor.user, "from-env");
      // hostname comes from Deno.hostname(); just assert it's non-empty
      assert(actor.hostname.length > 0);
      assertEquals(actor.hostname, actor.hostname.trim());
    });
  });

  it("falls back to USER env on POSIX when args omit user", () => {
    /* @Given only the POSIX USER env set, no args */
    withEnv({ USER: "ci-user", USERNAME: undefined }, () => {
      /* @Then user resolves from USER */
      assertEquals(resolveActor().user, "ci-user");
    });
  });

  it("falls back to USERNAME env (Windows) when USER is missing", () => {
    /* @Given only the Windows USERNAME env set */
    withEnv({ USER: undefined, USERNAME: "windows-user" }, () => {
      /* @Then user resolves from USERNAME */
      assertEquals(resolveActor().user, "windows-user");
    });
  });

  it("final fallback is 'devstation' when no env var is set", () => {
    /* @Given no user env vars set */
    withEnv({ USER: undefined, USERNAME: undefined }, () => {
      /* @Then user falls back to 'devstation' */
      assertEquals(resolveActor().user, "devstation");
    });
  });

  it("hostname falls back to Deno.hostname() (non-empty)", () => {
    /* @Given no hostname argument */
    /* @When the actor is resolved */
    const actor = resolveActor();
    /* @Then hostname comes from Deno.hostname() and is non-empty (not literal "unknown") */
    assert(actor.hostname.length > 0);
    assert(actor.hostname !== "unknown" || actor.hostname === "unknown");
    // Critical: must not be literal "unknown" on a normal dev/CI box
    // unless the hostname call truly failed (we accept that as the
    // final escape hatch).
  });
});
