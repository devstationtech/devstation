import { assertEquals, assertRejects } from "@std/assert";
import { beforeEach, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { BlueprintByIdResponse } from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import {
  buildClient,
  STUB_SESSION_ID,
  testContainer,
} from "@tests/blueprint/fixtures/bootstrap.ts";

describe("blueprint.byId endpoint — integration", () => {
  let rpc: Client;

  beforeEach(() => {
    rpc = buildClient(testContainer());
  });

  it("should return a single blueprint by id", async () => {
    /* @Given the real blueprint catalog */
    /* @When the client requests a known blueprint */
    const blueprint = await rpc.invoke<BlueprintByIdResponse>("blueprint.byId", {
      sessionId: STUB_SESSION_ID,
      id: "docker",
    });

    /* @Then it returns that blueprint */
    assertEquals(blueprint.id, "docker");
    assertEquals(blueprint.name, "docker");
  });

  it("should fail for an unknown blueprint", async () => {
    /* @Given the real blueprint catalog */
    /* @When the client requests a blueprint that does not exist */
    /* @Then the server replies with a not-found failure */
    await assertRejects(
      () =>
        rpc.invoke<BlueprintByIdResponse>("blueprint.byId", {
          sessionId: STUB_SESSION_ID,
          id: "does-not-exist",
        }),
      Exception,
      "not found",
    );
  });
});
