import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { BlueprintByIdMcpEndpoint } from "@server/blueprint/inbound/mcp/by-id/endpoint.ts";
import type { Query as BlueprintByIdQuery } from "@server/blueprint/application/queries/by-id/query.ts";
import type { BlueprintRecord } from "@server/blueprint/application/queries/records/blueprint-record.ts";

/**
 * Pins the wire metadata and dispatch glue for the blueprint `by-id`
 * MCP endpoint. No policy calls: blueprint BC has no MCP policy guard.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

function fakeBlueprintByIdQuery(record: BlueprintRecord | null): BlueprintByIdQuery {
  return { execute: (_id: string) => Promise.resolve(record) } as Anyish;
}

const sampleRecord: BlueprintRecord = {
  id: "k3s",
  name: "k3s",
  origin: "official",
  description: "K3s single-node cluster",
  version: "1.0.0",
  compatibility: { os: ["ubuntu-22.04"] },
  placement: "exclusive",
  inputs: [{ name: "replicas", label: "Replicas", type: "number", required: false, default: 1 }],
  roles: [],
  host: null,
  steps: [],
};

describe("BlueprintByIdMcpEndpoint", () => {
  it("declares read wire metadata", () => {
    /* @Given */
    const endpoint = new BlueprintByIdMcpEndpoint(fakeBlueprintByIdQuery(null));
    /* @Then */
    assertEquals(endpoint.name, "devstation_blueprint_get");
    assertEquals(endpoint.risk, "read");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("returns the mapped blueprint (toWire: default → value) when found", async () => {
    /* @Given */
    const endpoint = new BlueprintByIdMcpEndpoint(fakeBlueprintByIdQuery(sampleRecord));

    /* @When */
    const result = await endpoint.dispatch({ id: "k3s" }) as Record<string, unknown>;

    /* @Then the record comes back and the input's default field is renamed to value */
    assertEquals(result.id, "k3s");
    assertEquals(result.name, "k3s");
    const inputs = result.inputs as Record<string, unknown>[];
    assertEquals(inputs[0].value, 1);
    assertEquals((inputs[0] as Record<string, unknown>).default, undefined);
  });

  it("throws when the blueprint is not found", async () => {
    /* @Given a query that returns null */
    const endpoint = new BlueprintByIdMcpEndpoint(fakeBlueprintByIdQuery(null));

    /* @When / @Then */
    await assertRejects(
      () => endpoint.dispatch({ id: "missing-bp" }),
      Error,
      "missing-bp",
    );
  });
});
