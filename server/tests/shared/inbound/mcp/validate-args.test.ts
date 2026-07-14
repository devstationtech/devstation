import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { validateArgs } from "@server/shared/inbound/mcp/endpoint/validate-args.ts";

/**
 * Pins two failure modes for the schema gate:
 *
 *  - Missing required field: `cluster_provisioning_plan` with missing
 *    `nodeIds` crashed inside the handler with
 *    `args.nodeIds is not iterable` because nothing enforced
 *    `required` between MCP `tools/call` and dispatch.
 *  - Unknown field when additionalProperties is false: a renamed field
 *    (`id` after renaming to `clusterId`) reached the handler and produced
 *    `cluster 'undefined' not found.` instead of a clear schema rejection.
 *
 * `validateArgs` now sits between the wire and the dispatcher; both
 * shapes get rejected up-front with actionable messages.
 */
describe("validateArgs — schema gate", () => {
  const planSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeIds: { type: "array" },
    },
    required: ["clusterId", "nodeIds"],
    additionalProperties: false,
  };

  it("rejects when a required field is missing (nodeIds)", () => {
    /* @Given args missing the required nodeIds */
    /* @When validated against the plan schema */
    const err = validateArgs(
      { clusterId: "abc" } as Record<string, unknown>,
      planSchema as Record<string, unknown>,
    );
    /* @Then it reports the missing required field */
    assertEquals(err, "missing required field: 'nodeIds'");
  });

  it("rejects an unknown field when additionalProperties is false", () => {
    /* @Given args with an undeclared field and additionalProperties:false */
    /* @When validated */
    const err = validateArgs(
      { clusterId: "abc", nodeIds: [], skipTlsVerification: true } as Record<string, unknown>,
      planSchema as Record<string, unknown>,
    );
    /* @Then it reports the unknown field */
    assertEquals(
      err,
      "unknown field: 'skipTlsVerification' — not declared in the tool's input schema",
    );
  });

  it("rejects when a field has the wrong type", () => {
    /* @Given args with a wrongly-typed field */
    /* @When validated */
    const err = validateArgs(
      { clusterId: 42, nodeIds: [] } as Record<string, unknown>,
      planSchema as Record<string, unknown>,
    );
    /* @Then it reports the type mismatch */
    assertEquals(err, "field 'clusterId' must be a string (got number)");
  });

  it("accumulates multiple errors in one pass (missing required + unknown field together)", () => {
    /* @Given args that are both missing a required field and carry an extra one */
    // Mimics `cluster_get({id: "abc"})` against a schema where the
    // field was renamed to `clusterId`: extra `id`, missing `clusterId`.
    // Without accumulation, the user would fix the missing field and
    // only then discover the extra field on the next call. Now both
    // surface in the same response.
    const schema = {
      type: "object",
      properties: { clusterId: { type: "string" } },
      required: ["clusterId"],
      additionalProperties: false,
    };
    /* @When validated */
    const err = validateArgs(
      { id: "abc" } as Record<string, unknown>,
      schema as Record<string, unknown>,
    );
    /* @Then both the missing and unknown fields surface together */
    assertEquals(
      err,
      "missing required field: 'clusterId'; unknown field: 'id' — not declared in the tool's input schema",
    );
  });

  it("accepts a well-formed payload", () => {
    /* @Given a well-formed payload */
    /* @When validated */
    const err = validateArgs(
      { clusterId: "abc", nodeIds: ["n1"] } as Record<string, unknown>,
      planSchema as Record<string, unknown>,
    );
    /* @Then there is no error */
    assertEquals(err, null);
  });

  it("allows extra fields when additionalProperties is not false", () => {
    /* @Given a schema without additionalProperties:false and an extra field */
    const lax = {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    };
    /* @When validated */
    const err = validateArgs(
      { name: "x", extra: 1 } as Record<string, unknown>,
      lax as Record<string, unknown>,
    );
    /* @Then the extra field is allowed (no error) */
    assertEquals(err, null);
  });

  it("ignores non-object schemas (passthrough)", () => {
    /* @Given a non-object schema */
    /* @When validated */
    const err = validateArgs({}, { type: "string" } as Record<string, unknown>);
    /* @Then it passes through with no error */
    assertEquals(err, null);
  });

  it("treats null as a missing value — covers `{nodeIds: null}` shape", () => {
    /* @Given a required field present but set to null */
    /* @When validated */
    const err = validateArgs(
      { clusterId: "abc", nodeIds: null } as Record<string, unknown>,
      planSchema as Record<string, unknown>,
    );
    /* @Then the type check rejects it (must be an array) */
    // `nodeIds: null` is *present*, so the required-check passes;
    // but it fails type — needs to be an array. Either rejection is
    // acceptable as long as the dispatch path doesn't see it.
    assertEquals(err, "field 'nodeIds' must be a array (got null)");
  });

  it("treats undefined as missing", () => {
    /* @Given a required field present but set to undefined */
    /* @When validated */
    const err = validateArgs(
      { clusterId: "abc", nodeIds: undefined } as Record<string, unknown>,
      planSchema as Record<string, unknown>,
    );
    /* @Then the type check rejects it (must be an array) */
    // `in` operator returns true even for `undefined` values, so the
    // required-check passes; the type check then catches it.
    assertEquals(err, "field 'nodeIds' must be a array (got undefined)");
  });
});
