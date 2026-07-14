import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxNodesRegisterResponse,
  ClusterProxmoxNodesUnregisterAllResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const USERNAME_SECRET_ID = "00000000-0000-0000-0000-000000000011";
const PASSWORD_SECRET_ID = "00000000-0000-0000-0000-000000000012";

describe("cluster.proxmox.nodes.unregisterAll endpoint — integration", () => {
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

    for (const [name, ip] of [["n1", "10.0.0.10"], ["n2", "10.0.0.11"]]) {
      await rpc.invoke<ClusterProxmoxNodesRegisterResponse>(
        "cluster.proxmox.nodes.register",
        {
          sessionId: STUB_SESSION_ID,
          clusterId,
          name,
          ip,
          vaultId: VAULT_ID,
          usernameSecretId: USERNAME_SECRET_ID,
          passwordSecretId: PASSWORD_SECRET_ID,
        },
      );
    }
  });

  afterAll(() => persistence.teardown());

  it("removes every node from the cluster", async () => {
    /* @Given a cluster with two nodes (from beforeAll) */
    /* @When unregisterAll is invoked */
    await rpc.invoke<ClusterProxmoxNodesUnregisterAllResponse>(
      "cluster.proxmox.nodes.unregisterAll",
      { sessionId: STUB_SESSION_ID, clusterId },
    );

    /* @Then the cluster carries no nodes */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    assertEquals(target.nodes.length, 0);
  });
});
