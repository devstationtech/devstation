import { assertEquals } from "@std/assert";
import { beforeEach, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { BlueprintListResponse } from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import {
  buildClient,
  STUB_SESSION_ID,
  testContainer,
} from "@tests/blueprint/fixtures/bootstrap.ts";

describe("blueprint.list endpoint — integration", () => {
  let rpc: Client;

  beforeEach(() => {
    rpc = buildClient(testContainer());
  });

  it("should list the blueprint catalog", async () => {
    /* @Given the real blueprint catalog */
    /* @When the client lists blueprints */
    const blueprints = await rpc.invoke<BlueprintListResponse>("blueprint.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then it returns the parsed catalog with the expected shape */
    assertEquals(blueprints.length > 0, true);
    const docker = blueprints.find((b) => b.name === "docker");
    assertEquals(docker?.id, "docker");
    assertEquals(typeof docker?.version, "string");
    assertEquals(Array.isArray(docker?.compatibility.os), true);
  });

  it("should expose declared-input defaults as `value` (not `default`)", async () => {
    /* @Given a blueprint whose inputs declare a default */
    const blueprints = await rpc.invoke<BlueprintListResponse>("blueprint.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then no input carries the legacy `default` key — the wire uses `value` */
    for (const bp of blueprints) {
      for (const input of bp.inputs) {
        assertEquals(
          Object.prototype.hasOwnProperty.call(input, "default"),
          false,
        );
      }
    }
  });
});
