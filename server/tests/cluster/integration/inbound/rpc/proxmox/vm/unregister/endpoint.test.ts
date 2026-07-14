import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxImagesAssignResponse,
  ClusterProxmoxNodesRegisterResponse,
  ClusterProxmoxVirtualMachineRegisterResponse,
  ClusterProxmoxVirtualMachineUnregisterResponse,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

const VAULT_ID = "00000000-0000-0000-0000-000000000010";
const USERNAME_SECRET_ID = "00000000-0000-0000-0000-000000000011";
const PASSWORD_SECRET_ID = "00000000-0000-0000-0000-000000000012";
const imageId = "00000000-0000-0000-0000-0000000000a1";
const VM_VAULT_ID = "00000000-0000-0000-0000-000000000020";
const ROLE_ID = "00000000-0000-0000-0000-000000000100";
const SIZE_ID = "00000000-0000-0000-0000-000000000200";
const ENVIRONMENT_ID = "00000000-0000-0000-0000-000000000300";

describe("cluster.proxmox.virtualMachine.unregister endpoint — integration", () => {
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

    await rpc.invoke<ClusterProxmoxVirtualMachineRegisterResponse>(
      "cluster.proxmox.virtualMachine.register",
      {
        sessionId: STUB_SESSION_ID,
        clusterId,
        nodeId,
        name: "test-vm",
        id: 9001,
        role: ROLE_ID,
        size: SIZE_ID,
        image: imageId,
        environment: ENVIRONMENT_ID,
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
  });

  afterAll(() => persistence.teardown());

  it("removes the VM size from the node", async () => {
    /* @When the VM size is unregistered from the node */
    await rpc.invoke<ClusterProxmoxVirtualMachineUnregisterResponse>(
      "cluster.proxmox.virtualMachine.unregister",
      { sessionId: STUB_SESSION_ID, clusterId, nodeId, id: 9001 },
    );

    /* @Then the node has no remaining VMs */
    const records = await persistence.readClusters();
    const target = records.find((c) => c.id === clusterId)!;
    assertEquals(target.nodes[0].virtualMachines, []);
  });
});
