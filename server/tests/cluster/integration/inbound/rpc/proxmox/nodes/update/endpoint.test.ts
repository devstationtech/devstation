import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxNodesRegisterResponse,
  ClusterProxmoxNodesUpdateResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const USERNAME_SECRET_ID = "00000000-0000-0000-0000-000000000011";
const PASSWORD_SECRET_ID = "00000000-0000-0000-0000-000000000012";
const NEW_VAULT_ID = "00000000-0000-0000-0000-000000000020";

describe("cluster.proxmox.nodes.update endpoint — integration", () => {
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

  it("replaces the node's mutable fields", async () => {
    /* @When update is invoked with new name/ip/credential */
    await rpc.invoke<ClusterProxmoxNodesUpdateResponse>(
      "cluster.proxmox.nodes.update",
      {
        sessionId: STUB_SESSION_ID,
        clusterId,
        nodeId,
        name: "node-1-renamed",
        ip: "10.0.0.50",
        vaultId: NEW_VAULT_ID,
        usernameSecretId: USERNAME_SECRET_ID,
        passwordSecretId: PASSWORD_SECRET_ID,
      },
    );

    /* @Then persisted cluster reflects the update */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    assertEquals(target.nodes[0].name, "node-1-renamed");
    assertEquals(target.nodes[0].address, "10.0.0.50");
    assertEquals(target.nodes[0].credential!.vaultId, NEW_VAULT_ID);
  });

  it("rejects when the node id is missing", async () => {
    /* @When update is invoked with unknown nodeId */
    /* @Then the server replies with a failure */
    await assertRejects(
      () =>
        rpc.invoke<ClusterProxmoxNodesUpdateResponse>(
          "cluster.proxmox.nodes.update",
          {
            sessionId: STUB_SESSION_ID,
            clusterId,
            nodeId: "non-existent-id",
            name: "x",
            ip: "10.0.0.99",
            vaultId: NEW_VAULT_ID,
            usernameSecretId: USERNAME_SECRET_ID,
            passwordSecretId: PASSWORD_SECRET_ID,
          },
        ),
      Exception,
    );
  });
});
