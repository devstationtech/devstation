import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterRegisterResponse,
  ClusterUnregisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

describe("cluster.unregister endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("should remove a previously registered cluster", async () => {
    /* @Given a registered cluster */
    await rpc.invoke<ClusterRegisterResponse>("cluster.register", {
      sessionId: STUB_SESSION_ID,
      name: "to-remove",
      user: "alice",
      hostname: "workstation",
    });
    const before = await persistence.readClusters();
    const targetId = before.find((c) => c.name === "to-remove")!.id;

    /* @When the unregister endpoint is invoked with the cluster id */
    await rpc.invoke<ClusterUnregisterResponse>("cluster.unregister", {
      sessionId: STUB_SESSION_ID,
      id: targetId,
    });

    /* @Then the cluster is gone from the catalog */
    const after = await persistence.readClusters();
    assertEquals(after.some((c) => c.id === targetId), false);
  });

  it("rejects when the cluster id does not exist", async () => {
    /* @Given no cluster with the requested id */
    /* @When unregister is called with an unknown id */
    /* @Then the server replies with a failure */
    await assertRejects(
      () =>
        rpc.invoke<ClusterUnregisterResponse>("cluster.unregister", {
          sessionId: STUB_SESSION_ID,
          id: "non-existent-id",
        }),
      Exception,
      "not found",
    );
  });
});
