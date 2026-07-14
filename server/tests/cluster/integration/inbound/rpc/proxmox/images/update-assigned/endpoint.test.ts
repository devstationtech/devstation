import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxImagesAssignResponse,
  ClusterProxmoxImagesUpdateAssignedResponse,
  ClusterProxmoxNodesRegisterResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const USERNAME_SECRET_ID = "00000000-0000-0000-0000-000000000011";
const PASSWORD_SECRET_ID = "00000000-0000-0000-0000-000000000012";
const IMAGE_ID = "00000000-0000-0000-0000-0000000000a1";

describe("cluster.proxmox.images.updateAssigned endpoint — integration", () => {
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

  it("replaces virtualMachineId and storage on an existing assignment", async () => {
    /* @When the existing assignment is updated with a new virtualMachineId and storage */
    await rpc.invoke<ClusterProxmoxImagesUpdateAssignedResponse>(
      "cluster.proxmox.images.updateAssigned",
      {
        sessionId: STUB_SESSION_ID,
        clusterId,
        nodeId,
        imageId: IMAGE_ID,
        virtualMachineId: 9001,
        storage: "local-lvm",
      },
    );

    /* @Then the assignment reflects the new virtualMachineId and storage */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    const nodeImages = target.nodes[0].images ?? [];
    assertEquals(nodeImages.length, 1);
    assertEquals(nodeImages[0].virtualMachineId, 9001);
    assertEquals(nodeImages[0].storage, "local-lvm");
  });
});
