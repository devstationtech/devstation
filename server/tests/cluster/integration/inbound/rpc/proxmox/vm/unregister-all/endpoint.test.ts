import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterProxmoxImagesAssignResponse,
  ClusterProxmoxNodesRegisterResponse,
  ClusterProxmoxVirtualMachineRegisterResponse,
  ClusterProxmoxVirtualMachineUnregisterAllResponse,
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

describe("cluster.proxmox.virtualMachine.unregisterAll endpoint — integration", () => {
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

    // Register two VMs
    for (const [id, ip] of [[9001, "10.0.0.100"], [9002, "10.0.0.101"]] as const) {
      await rpc.invoke<ClusterProxmoxVirtualMachineRegisterResponse>(
        "cluster.proxmox.virtualMachine.register",
        {
          sessionId: STUB_SESSION_ID,
          clusterId,
          nodeId,
          name: `test-vm-${id}`,
          id,
          role: ROLE_ID,
          size: SIZE_ID,
          image: imageId,
          environment: ENVIRONMENT_ID,
          ip,
          gateway: "10.0.0.1",
          dns: "10.0.0.1",
          storage: "local-zfs",
          cpu: 1,
          ram: 512,
          disk: 10,
          credentialVaultId: VM_VAULT_ID,
          usernameSecretId: USERNAME_SECRET_ID,
          passwordSecretId: PASSWORD_SECRET_ID,
        },
      );
    }
  });

  afterAll(() => persistence.teardown());

  it("removes every VM from the node", async () => {
    /* @Given node with 2 VMs */
    const before = await persistence.readClusters();
    assertEquals(before[0].nodes[0].virtualMachines.length, 2);

    /* @When unregisterAll is invoked */
    await rpc.invoke<ClusterProxmoxVirtualMachineUnregisterAllResponse>(
      "cluster.proxmox.virtualMachine.unregisterAll",
      { sessionId: STUB_SESSION_ID, clusterId, nodeId },
    );

    /* @Then node has no VMs */
    const after = await persistence.readClusters();
    assertEquals(after[0].nodes[0].virtualMachines, []);
  });
});
