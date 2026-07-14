import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxNodesRegisterResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const USERNAME_SECRET_ID = "00000000-0000-0000-0000-000000000011";
const PASSWORD_SECRET_ID = "00000000-0000-0000-0000-000000000012";

describe("cluster.proxmox.nodes.register endpoint — integration", () => {
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

  it("registers a new node under the cluster", async () => {
    /* @When the node is registered */
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

    /* @Then the persisted cluster carries the node */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    assertEquals(target.nodes.length, 1);
    assertEquals(target.nodes[0].name, "node-1");
    assertEquals(target.nodes[0].address, "10.0.0.10");
    assertEquals(target.nodes[0].credential!.vaultId, VAULT_ID);
  });

  it("rejects a duplicate node name", async () => {
    /* @Given the previous test registered "node-1" */
    /* @When a second registration with the same name is attempted */
    /* @Then the server replies with a failure */
    await assertRejects(
      () =>
        rpc.invoke<ClusterProxmoxNodesRegisterResponse>(
          "cluster.proxmox.nodes.register",
          {
            sessionId: STUB_SESSION_ID,
            clusterId,
            name: "node-1",
            ip: "10.0.0.20",
            vaultId: VAULT_ID,
            usernameSecretId: USERNAME_SECRET_ID,
            passwordSecretId: PASSWORD_SECRET_ID,
          },
        ),
      Exception,
    );
  });
});
