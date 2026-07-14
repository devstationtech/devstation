import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { AuthResourcesResponse } from "@jsonrpc-contracts-ts/auth.gen.ts";
import { buildClient, testContainer } from "@tests/auth/fixtures/bootstrap.ts";
import { Persistence } from "@tests/auth/integration/outbound/persistence.ts";

describe("auth.resources endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeEach(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterEach(() => persistence.teardown());

  it("should report numeric cpu/ram percentages (public, no session)", async () => {
    /* @Given no session at all */
    /* @When the client asks for host resources */
    const res = await rpc.invoke<AuthResourcesResponse>("auth.resources", {});

    /* @Then both metrics are numbers in the 0..100 range */
    assertEquals(typeof res.cpuPercent, "number");
    assertEquals(typeof res.ramPercent, "number");
    assertEquals(res.cpuPercent >= 0 && res.cpuPercent <= 100, true);
    assertEquals(res.ramPercent >= 0 && res.ramPercent <= 100, true);
  });
});
