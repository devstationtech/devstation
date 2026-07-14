import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxConnectResponse,
  ClusterProxmoxDisconnectResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const SECRET_ID = "00000000-0000-0000-0000-000000000011";

describe("cluster.proxmox.disconnect endpoint — integration", () => {
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
    const records = await persistence.readClusters();
    clusterId = records[0].id;

    await rpc.invoke<ClusterProxmoxConnectResponse>("cluster.proxmox.connect", {
      sessionId: STUB_SESSION_ID,
      clusterId,
      host: "10.0.0.5",
      vaultId: VAULT_ID,
      secretId: SECRET_ID,
    });
  });

  afterAll(() => persistence.teardown());

  it("clears the connection from a connected cluster", async () => {
    /* @Given a cluster with an attached connection (from beforeAll) */
    /* @When disconnect is invoked */
    await rpc.invoke<ClusterProxmoxDisconnectResponse>(
      "cluster.proxmox.disconnect",
      { sessionId: STUB_SESSION_ID, clusterId },
    );

    /* @Then the persisted connection is gone */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    assertEquals(target.connection, null);
  });

  it("rejects when the cluster id is missing", async () => {
    /* @When disconnect is invoked with an unknown clusterId */
    /* @Then the server replies with a failure */
    await assertRejects(
      () =>
        rpc.invoke<ClusterProxmoxDisconnectResponse>(
          "cluster.proxmox.disconnect",
          { sessionId: STUB_SESSION_ID, clusterId: "non-existent-id" },
        ),
      Exception,
    );
  });
});
