import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  ALL_MCP_SCOPES,
  isMcpScope,
  MCP_SCOPE_CATALOG,
} from "@server/shared/inbound/mcp/scope/catalog.ts";
import { Scope } from "@server/auth/domain/models/access-token/scope.ts";

/**
 * The MCP scope catalogue — the scopes an access token can carry.
 * Pins the catalogue's contents and cross-checks every scope against
 * the auth-domain `Scope` VO shape (so the MCP catalogue can never
 * drift into a string the token domain would reject).
 */

describe("MCP scope catalogue", () => {
  it("groups the coarse PAT-style scopes by context", () => {
    assertEquals(MCP_SCOPE_CATALOG.map((g) => g.context), [
      "clusters",
      "stations",
      "vault",
      "sizes",
      "images",
      "blueprints",
      "executions",
    ]);
  });

  it("ALL_MCP_SCOPES is the flat list, including the cluster provisioning sub-scopes", () => {
    assertEquals([...ALL_MCP_SCOPES].sort(), [
      "blueprints:read",
      "clusters:provision:apply",
      "clusters:provision:destroy",
      "clusters:provision:plan",
      "clusters:read",
      "clusters:write",
      "executions:read",
      "executions:write",
      "images:read",
      "images:write",
      "sizes:read",
      "sizes:write",
      "stations:read",
      "stations:write",
      "vault:read",
      "vault:write",
    ]);
  });

  it("isMcpScope accepts catalogue scopes and rejects anything else", () => {
    assertEquals(isMcpScope("clusters:provision:apply"), true);
    assertEquals(isMcpScope("clusters:provision:reboot"), false);
    assertEquals(isMcpScope("nonsense"), false);
  });

  it("the TUI scope menu mirrors the engine catalogue exactly", async () => {
    /* @Given the engine scope catalogue and the TUI selection menu
       (tui/ink/src/mcp/scope-catalog.ts), which must offer the same
       scopes in the same order — the UI cannot import server code, so
       this content check is the sync gate between the two files */
    const tui = await Deno.readTextFile(
      new URL("../../../tui/ink/src/mcp/scope-catalog.ts", import.meta.url),
    );

    /* @When the scope ids are extracted from the TUI catalogue source */
    const offered = [...tui.matchAll(/scope: "([^"]+)"/g)].map((m) => m[1]);

    /* @Then they match the engine's flat validation set, order included */
    assertEquals(offered, [...ALL_MCP_SCOPES]);
  });

  it("every catalogue scope is a valid auth-domain Scope", () => {
    /* @Given every scope the MCP catalogue exposes */
    /* @Then each one constructs as a `Scope` without throwing — the MCP
       catalogue and the token domain agree on the scope grammar */
    for (const scope of ALL_MCP_SCOPES) {
      assertEquals(new Scope(scope).value, scope);
    }
  });
});
