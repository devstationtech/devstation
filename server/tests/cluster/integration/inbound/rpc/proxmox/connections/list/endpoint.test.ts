import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxConnectionsListResponse,
  ClusterProxmoxConnectResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const SECRET_ID = "00000000-0000-0000-0000-000000000011";

describe("cluster.proxmox.connections.list endpoint — integration", () => {
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

  it("returns an empty list for a cluster without connection", async () => {
    /* @When connections are listed for a freshly registered cluster */
    const response = await rpc.invoke<ClusterProxmoxConnectionsListResponse>(
      "cluster.proxmox.connections.list",
      { sessionId: STUB_SESSION_ID, clusterId },
    );
    /* @Then no connections are reported */
    assertEquals(response, []);
  });

  it("returns the single connection once attached", async () => {
    /* @Given a connection attached without a provisioning override */
    await rpc.invoke<ClusterProxmoxConnectResponse>("cluster.proxmox.connect", {
      sessionId: STUB_SESSION_ID,
      clusterId,
      host: "10.0.0.5",
      vaultId: VAULT_ID,
      secretId: SECRET_ID,
    });

    /* @When the connections are listed */
    const response = await rpc.invoke<ClusterProxmoxConnectionsListResponse>(
      "cluster.proxmox.connections.list",
      { sessionId: STUB_SESSION_ID, clusterId },
    );
    /* @Then the connection surfaces with the default provisioning policy */
    assertEquals(response.length, 1);
    assertEquals(response[0], {
      host: "10.0.0.5",
      vaultId: VAULT_ID,
      secretId: SECRET_ID,
      // connect without override → default policy.
      cloneStrategy: "auto",
      parallelism: 1,
    });
  });

  it("exposes an explicit provisioning policy override", async () => {
    /* @Given a connection attached with an explicit clone strategy + parallelism */
    await rpc.invoke<ClusterProxmoxConnectResponse>("cluster.proxmox.connect", {
      sessionId: STUB_SESSION_ID,
      clusterId,
      host: "10.0.0.5",
      vaultId: VAULT_ID,
      secretId: SECRET_ID,
      cloneStrategy: "full",
      parallelism: 4,
    });

    /* @When the connections are listed */
    const response = await rpc.invoke<ClusterProxmoxConnectionsListResponse>(
      "cluster.proxmox.connections.list",
      { sessionId: STUB_SESSION_ID, clusterId },
    );
    /* @Then the override is reflected back */
    assertEquals(response[0].cloneStrategy, "full");
    assertEquals(response[0].parallelism, 4);
  });

  it("returns empty for a non-existent cluster id", async () => {
    /* @When connections are listed for an unknown cluster id */
    const response = await rpc.invoke<ClusterProxmoxConnectionsListResponse>(
      "cluster.proxmox.connections.list",
      { sessionId: STUB_SESSION_ID, clusterId: "non-existent" },
    );
    /* @Then an empty list is returned rather than an error */
    assertEquals(response, []);
  });
});
