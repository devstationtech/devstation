import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxProvisionResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

describe("cluster.proxmox.provision endpoint — integration", () => {
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

  it("returns the provisioning preview for a fresh cluster (no nodes/images)", async () => {
    /* @When the provisioning preview is requested for a fresh cluster */
    const response = await rpc.invoke<ClusterProxmoxProvisionResponse>(
      "cluster.proxmox.provision",
      { sessionId: STUB_SESSION_ID, clusterId },
    );
    /* @Then the preview echoes the cluster identity with empty nodes/images */
    assertEquals(response.clusterId, clusterId);
    assertEquals(response.clusterName, "homelab");
    assertEquals(response.connected, false);
    assertEquals(response.nodes, []);
    assertEquals(response.images, []);
  });

  it("rejects when the cluster id is missing", async () => {
    /* @When the preview is requested for an unknown cluster id */
    /* @Then it rejects with a not-found error */
    await assertRejects(
      () =>
        rpc.invoke<ClusterProxmoxProvisionResponse>(
          "cluster.proxmox.provision",
          { sessionId: STUB_SESSION_ID, clusterId: "non-existent-id" },
        ),
      Exception,
      "not found",
    );
  });
});
