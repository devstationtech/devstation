import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { McpPolicy } from "@server/shared/inbound/mcp/policy/mcp-policy.ts";
import { PolicyViolation } from "@server/shared/inbound/mcp/policy/violation.ts";

describe("McpPolicy.load", () => {
  it("returns OFF when env is unset/empty", () => {
    /* @Given an empty/whitespace policy string */
    /* @Then load returns the OFF policy */
    assertEquals(McpPolicy.load(""), McpPolicy.OFF);
    assertEquals(McpPolicy.load("   "), McpPolicy.OFF);
  });

  it("parses prefix and allow keys (repeatable, comma-separated)", () => {
    /* @Given a comma-separated string with repeated prefix/allow keys */
    /* @When loaded */
    const p = McpPolicy.load("prefix:ds-e2e-,allow:homelab,allow:foo,prefix:test-");
    /* @Then prefixes and allowClusters accumulate in order */
    assertEquals(p.prefixes, ["ds-e2e-", "test-"]);
    assertEquals(p.allowClusters, ["homelab", "foo"]);
  });

  it("ignores unknown keys and malformed parts (forward-compat)", () => {
    /* @Given a string mixing valid, unknown, and malformed parts */
    /* @When loaded */
    const p = McpPolicy.load("prefix:ds-e2e-,xunknown:thing,bareword,allow:");
    /* @Then only the valid keys are kept */
    assertEquals(p.prefixes, ["ds-e2e-"]);
    assertEquals(p.allowClusters, []);
  });
});

describe("McpPolicy#requirePrefix", () => {
  it("is a no-op when policy is OFF (default)", () => {
    /* @Given the OFF policy */
    /* @Then requirePrefix never throws */
    // never throws — full feature exposure when nothing is configured
    McpPolicy.OFF.requirePrefix("prod-cluster");
    McpPolicy.OFF.requirePrefix(undefined);
  });

  it("passes when any resolved identity carries a configured prefix", () => {
    /* @Given a policy requiring the ds-e2e- prefix */
    const p = McpPolicy.load("prefix:ds-e2e-");
    /* @Then requirePrefix passes when any identity carries it */
    p.requirePrefix("ds-e2e-homelab");
    p.requirePrefix(undefined, "ds-e2e-cp4");
  });

  it("throws PolicyViolation when no identity carries the prefix", () => {
    /* @Given a policy requiring the ds-e2e- prefix */
    const p = McpPolicy.load("prefix:ds-e2e-");
    /* @Then requirePrefix throws for an identity without it */
    assertThrows(() => p.requirePrefix("prod"), PolicyViolation, "prefixes [ds-e2e-]");
  });

  it("throws PolicyViolation when identity is unresolved (all empty) but policy is on", () => {
    /* @Given an active policy and an unresolved (all-empty) identity */
    const p = McpPolicy.load("prefix:ds-e2e-");
    /* @Then requirePrefix throws a could-not-be-resolved violation */
    assertThrows(
      () => p.requirePrefix(undefined, ""),
      PolicyViolation,
      "could not be resolved",
    );
  });
});

describe("McpPolicy#requireMutableCluster", () => {
  it("is a no-op when policy is OFF", () => {
    /* @Given the OFF policy */
    /* @Then requireMutableCluster never throws */
    McpPolicy.OFF.requireMutableCluster("any-cluster");
  });

  it("allowlist widens past the prefix check", () => {
    /* @Given a policy with a prefix plus an allowlisted cluster */
    const p = McpPolicy.load("prefix:ds-e2e-,allow:homelab");
    /* @Then allowlisted or prefixed clusters pass, others throw */
    p.requireMutableCluster("homelab"); // allowed without prefix
    p.requireMutableCluster("ds-e2e-other"); // prefixed always ok
    assertThrows(() => p.requireMutableCluster("prod"), PolicyViolation, "prefix");
  });

  it("PolicyViolation is an Error", () => {
    /* @Given a PolicyViolation */
    /* @Then it is an instance of Error */
    assertEquals(new PolicyViolation("x") instanceof Error, true);
  });
});
