import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxNodesRegisterResponse,
  ClusterProxmoxNodesUnregisterResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const USERNAME_SECRET_ID = "00000000-0000-0000-0000-000000000011";
const PASSWORD_SECRET_ID = "00000000-0000-0000-0000-000000000012";

describe("cluster.proxmox.nodes.unregister endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let clusterId: string;
  let nodeId: string;

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

    await rpc.invoke<ClusterProxmoxNodesRegisterResponse>(
      "cluster.proxmox.nodes.register",
      {
        sessionId: STUB_SESSION_ID,
        clusterId,
        name: "node-1",
        ip: "10.0.0.10",
        vaultId: VAULT_ID,
        usernameSecretId: USERNAME_SECRET_ID,
        passwordSecretId: PASSWORD_SECRET_ID,
      },
    );
    nodeId = (await persistence.readClusters())[0].nodes[0].id;
  });

  afterAll(() => persistence.teardown());

  it("removes the node from the cluster", async () => {
    /* @When unregister is invoked for the existing nodeId */
    await rpc.invoke<ClusterProxmoxNodesUnregisterResponse>(
      "cluster.proxmox.nodes.unregister",
      { sessionId: STUB_SESSION_ID, clusterId, nodeId },
    );

    /* @Then the cluster carries no nodes */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    assertEquals(target.nodes.length, 0);
  });

  it("rejects when the node id is missing", async () => {
    /* @When unregister is invoked with an unknown nodeId */
    /* @Then the server replies with a failure */
    await assertRejects(
      () =>
        rpc.invoke<ClusterProxmoxNodesUnregisterResponse>(
          "cluster.proxmox.nodes.unregister",
          { sessionId: STUB_SESSION_ID, clusterId, nodeId: "non-existent-id" },
        ),
      Exception,
    );
  });
});
