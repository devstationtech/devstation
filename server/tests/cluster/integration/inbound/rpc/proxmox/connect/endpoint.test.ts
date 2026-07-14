import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxConnectResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const SECRET_ID = "00000000-0000-0000-0000-000000000011";

describe("cluster.proxmox.connect endpoint — integration", () => {
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
  });

  afterAll(() => persistence.teardown());

  it("attaches a connection to an existing Proxmox cluster", async () => {
    /* @When connect is invoked for the registered cluster */
    await rpc.invoke<ClusterProxmoxConnectResponse>("cluster.proxmox.connect", {
      sessionId: STUB_SESSION_ID,
      clusterId,
      host: "10.0.0.5",
      vaultId: VAULT_ID,
      secretId: SECRET_ID,
    });

    /* @Then the cluster persisted connection matches */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    assertEquals(target.connection, {
      host: "10.0.0.5",
      vaultId: VAULT_ID,
      secretId: SECRET_ID,
      // connect without explicit policy → default persisted.
      policy: { cloneStrategy: "auto", parallelism: 1 },
    });
  });

  it("rejects when the cluster id is missing", async () => {
    /* @When connect is invoked with an unknown clusterId */
    /* @Then the server replies with a failure */
    await assertRejects(
      () =>
        rpc.invoke<ClusterProxmoxConnectResponse>("cluster.proxmox.connect", {
          sessionId: STUB_SESSION_ID,
          clusterId: "non-existent-id",
          host: "10.0.0.5",
          vaultId: VAULT_ID,
          secretId: SECRET_ID,
        }),
      Exception,
    );
  });
});
