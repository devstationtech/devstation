import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxImagesAssignResponse,
  ClusterProxmoxNodesRegisterResponse,
  ClusterProxmoxVirtualMachineRegisterResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const USERNAME_SECRET_ID = "00000000-0000-0000-0000-000000000011";
const PASSWORD_SECRET_ID = "00000000-0000-0000-0000-000000000012";
const imageId = "00000000-0000-0000-0000-0000000000a1";
const VM_VAULT_ID = "00000000-0000-0000-0000-000000000020";

describe("cluster.proxmox.virtualMachine.register endpoint — integration", () => {
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
        imageId,
        virtualMachineId: 9000,
        storage: "local-zfs",
        name: "ubuntu-2204",
        os: "ubuntu-22-04",
        sourceUrl: "https://cloud-images.example/22.04.img",
      },
    );
  });

  afterAll(() => persistence.teardown());

  it("registers a virtual-machine size on a node", async () => {
    /* @When a VM size is registered on the node */
    await rpc.invoke<ClusterProxmoxVirtualMachineRegisterResponse>(
      "cluster.proxmox.virtualMachine.register",
      {
        sessionId: STUB_SESSION_ID,
        clusterId,
        nodeId,
        name: "test-vm",
        id: 9001,
        size: "00000000-0000-0000-0000-000000000200",
        image: imageId,
        tags: ["k3s", "db"],
        ip: "10.0.0.100",
        gateway: "10.0.0.1",
        dns: "10.0.0.1",
        storage: "local-zfs",
        cpu: 2,
        ram: 1024,
        disk: 20,
        credentialVaultId: VM_VAULT_ID,
        usernameSecretId: USERNAME_SECRET_ID,
        passwordSecretId: PASSWORD_SECRET_ID,
      },
    );

    /* @Then the node carries the VM with its address, resources and tags */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    const virtualMachines = target.nodes[0].virtualMachines;
    assertEquals(virtualMachines.length, 1);
    assertEquals(virtualMachines[0].id, 9001);
    assertEquals(virtualMachines[0].address, "10.0.0.100");
    assertEquals(virtualMachines[0].resources.cpu, 2);
    assertEquals(virtualMachines[0].tags, ["k3s", "db"]);
  });
});
