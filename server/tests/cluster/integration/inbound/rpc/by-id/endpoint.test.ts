import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterByIdResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

describe("cluster.byId endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let clusterId: string;

  beforeAll(async () => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);

    await rpc.invoke<ClusterRegisterResponse>("cluster.register", {
      sessionId: STUB_SESSION_ID,
      name: "homelab",
      user: "alice",
      hostname: "workstation",
    });
    clusterId = (await persistence.readClusters())[0].id;
  });

  afterAll(() => persistence.teardown());

  it("returns the cluster summary for an existing id", async () => {
    /* @When byId is invoked with a registered cluster id */
    const response = await rpc.invoke<ClusterByIdResponse>("cluster.byId", {
      sessionId: STUB_SESSION_ID,
      id: clusterId,
    });
    /* @Then the summary carries the cluster identity, provider and provenance */
    assertEquals(response.id, clusterId);
    assertEquals(response.name, "homelab");
    assertEquals(response.provider, "proxmox");
    assertEquals(response.connected, false);
    assertEquals(response.version, 1);
    assertEquals(response.creation.by, "alice");
  });

  it("rejects when the id is missing", async () => {
    /* @When byId is invoked with an unknown id */
    /* @Then it rejects with a not-found error */
    await assertRejects(
      () =>
        rpc.invoke<ClusterByIdResponse>("cluster.byId", {
          sessionId: STUB_SESSION_ID,
          id: "non-existent-id",
        }),
      Exception,
      "not found",
    );
  });
});
