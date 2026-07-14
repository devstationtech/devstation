import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
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

describe("cluster.proxmox.images.assign endpoint — integration", () => {
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

  it("associates a catalog image (with its snapshot) to a node + virtualMachineId + storage slot", async () => {
    /* @When a catalog image is assigned to a node with a virtualMachineId, storage and snapshot */
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

    /* @Then the node carries the assignment with the chosen vmid, storage and snapshot */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    const nodeImages = target.nodes[0].images ?? [];
    assertEquals(nodeImages.length, 1);
    assertEquals(nodeImages[0].imageId, IMAGE_ID);
    assertEquals(nodeImages[0].virtualMachineId, 9000);
    assertEquals(nodeImages[0].storage, "local-zfs");
    assertEquals(nodeImages[0].name, "ubuntu-2204");
  });
});
