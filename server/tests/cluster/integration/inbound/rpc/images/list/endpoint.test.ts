import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterImagesListResponse,
  ClusterProxmoxImagesAssignResponse,
  ClusterProxmoxNodesRegisterResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const USERNAME_SECRET_ID = "00000000-0000-0000-0000-000000000011";
const PASSWORD_SECRET_ID = "00000000-0000-0000-0000-000000000012";
const IMAGE_ID = "00000000-0000-0000-0000-0000000000a1";

describe("cluster.images.list endpoint — integration", () => {
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

    await rpc.invoke<ClusterProxmoxImagesAssignResponse>(
      "cluster.proxmox.images.assign",
      {
        sessionId: STUB_SESSION_ID,
        clusterId,
        nodeId,
        imageId: IMAGE_ID,
        virtualMachineId: 9000,
        storage: "local-zfs",
        name: "ubuntu-2204",
        os: "ubuntu-22-04",
        sourceUrl: "https://cloud-images.example/22.04.img",
      },
    );
  });

  afterAll(() => persistence.teardown());

  it("returns every image assignment with its cluster + node context", async () => {
    /* @When the assignments are listed without a filter */
    const response = await rpc.invoke<ClusterImagesListResponse>(
      "cluster.images.list",
      { sessionId: STUB_SESSION_ID },
    );
    /* @Then the single assignment is returned with its snapshot + materialization */
    assertEquals(response.length, 1);
    assertEquals(response[0].imageId, IMAGE_ID);
    assertEquals(response[0].name, "ubuntu-2204");
    assertEquals(response[0].clusterName, "homelab");
    assertEquals(response[0].nodeName, "node-1");
    assertEquals(response[0].virtualMachineId, 9000);
    assertEquals(response[0].storage, "local-zfs");
  });

  it("filters by clusterId when provided", async () => {
    /* @When listing with the owning clusterId */
    const matching = await rpc.invoke<ClusterImagesListResponse>(
      "cluster.images.list",
      { sessionId: STUB_SESSION_ID, clusterId },
    );
    /* @Then only that cluster's assignments come back */
    assertEquals(matching.length, 1);

    /* @And an unknown clusterId yields an empty list */
    const none = await rpc.invoke<ClusterImagesListResponse>(
      "cluster.images.list",
      { sessionId: STUB_SESSION_ID, clusterId: "non-existent" },
    );
    assertEquals(none, []);
  });
});
