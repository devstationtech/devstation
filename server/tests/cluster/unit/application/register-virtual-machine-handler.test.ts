import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { RegisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/register-virtual-machine-handler.ts";
import { RegisterVirtualMachine } from "@server/cluster/application/commands/proxmox/register-virtual-machine.ts";
import { VirtualMachineAlreadyExists } from "@server/cluster/domain/exceptions/virtual-machine-already-exists.ts";
import { ImageNotAssigned } from "@server/cluster/domain/exceptions/image-not-assigned.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { nodeImage, registerNode } from "@tests/cluster/fixtures/operations.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

/**
 * RegisterVirtualMachineHandler delegates to ProxmoxCluster's
 * registerVirtualMachine which enforces three invariants worth
 * pinning end-to-end:
 *  - vmid uniqueness across the WHOLE cluster (not just per node);
 *  - IP uniqueness across the whole cluster;
 *  - assigned image must be present on the target node.
 */

function fakeClustersWith(cluster: ProxmoxCluster): { clusters: Clusters } {
  // deno-lint-ignore no-explicit-any
  const stub: any = {
    of: () => Promise.resolve(cluster),
    update: async <T>(_id: unknown, change: (c: T) => unknown) => {
      await change(cluster as unknown as T);
      return cluster;
    },
    add: () => Promise.reject(new Error("not used")),
    remove: () => Promise.reject(new Error("not used")),
    exists: () => Promise.resolve(true),
    byName: () => Promise.resolve(null),
    all: () => Promise.resolve([cluster]),
  };
  return { clusters: stub as Clusters };
}

function aReadyCluster() {
  const cluster = ProxmoxCluster.register(
    new Id(),
    new Name("homelab"),
    new Creation(
      new User("alice"),
      new Hostname("workstation"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
  const node = registerNode("cp4", "192.168.15.194");
  cluster.registerNode(node);
  cluster.assignImage(node.id, nodeImage());
  return { cluster, node };
}

const ASSIGNED_IMAGE_ID = "00000000-0000-0000-0000-0000000090a0"; // matches fixtures default

function aValidCommand(clusterId: string, nodeId: string, overrides: Partial<{
  id: number;
  ip: string;
  imageId: string;
}> = {}) {
  return new RegisterVirtualMachine(
    clusterId,
    nodeId,
    "k3s-server",
    overrides.id ?? 101,
    "k3s-server",
    overrides.imageId ?? ASSIGNED_IMAGE_ID,
    overrides.ip ?? "10.0.0.101",
    "192.168.15.1",
    "8.8.8.8",
    "local-zfs",
    2,
    2048,
    20,
    "00000000-0000-0000-0000-000000000010",
    "00000000-0000-0000-0000-000000000011",
    "00000000-0000-0000-0000-000000000012",
    ["k3s"],
  );
}

describe("RegisterVirtualMachineHandler — happy path", () => {
  it("registers a VM on the node when vmid + IP are free and image is assigned", async () => {
    /* @Given a cluster with one node and an assigned image */
    const { cluster, node } = aReadyCluster();
    const { clusters } = fakeClustersWith(cluster);
    const handler = new RegisterVirtualMachineHandler(clusters);
    /* @When register runs */
    await handler.handle(aValidCommand(cluster.id.value, node.id.value));
    /* @Then the VM is on the node */
    assertEquals(cluster.nodes.of(node.id).virtualMachines.length, 1);
  });
});

describe("RegisterVirtualMachineHandler — invariants", () => {
  it("rejects when the vmid already exists ANYWHERE in the cluster (not just on this node)", async () => {
    /* @Given a cluster with a VM at vmid 101 on node 'cp4' */
    const { cluster, node } = aReadyCluster();
    const { clusters } = fakeClustersWith(cluster);
    const handler = new RegisterVirtualMachineHandler(clusters);
    await handler.handle(
      aValidCommand(cluster.id.value, node.id.value, { id: 101, ip: "10.0.0.101" }),
    );
    /* @When a second register reuses vmid 101 (different IP) */
    /* @Then VirtualMachineAlreadyExists — vmid is cluster-wide unique */
    await assertRejects(
      () =>
        handler.handle(
          aValidCommand(cluster.id.value, node.id.value, { id: 101, ip: "10.0.0.102" }),
        ),
      VirtualMachineAlreadyExists,
    );
  });

  it("rejects when the IP already exists ANYWHERE in the cluster", async () => {
    /* @Given a cluster with a VM at IP 10.0.0.101 */
    const { cluster, node } = aReadyCluster();
    const { clusters } = fakeClustersWith(cluster);
    const handler = new RegisterVirtualMachineHandler(clusters);
    await handler.handle(
      aValidCommand(cluster.id.value, node.id.value, { id: 101, ip: "10.0.0.101" }),
    );
    /* @When a second register reuses the IP under a different vmid */
    /* @Then VirtualMachineAlreadyExists — IP is cluster-wide unique */
    await assertRejects(
      () =>
        handler.handle(
          aValidCommand(cluster.id.value, node.id.value, { id: 102, ip: "10.0.0.101" }),
        ),
      VirtualMachineAlreadyExists,
    );
  });

  it("rejects when the assigned image is not registered on the target node", async () => {
    /* @Given a cluster + node BUT no image assigned */
    const cluster = ProxmoxCluster.register(
      new Id(),
      new Name("homelab"),
      new Creation(
        new User("alice"),
        new Hostname("workstation"),
        Instant.fromString("2026-01-01T00:00:00.000Z"),
      ),
    );
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    /* (no image assigned this time) */
    const { clusters } = fakeClustersWith(cluster);
    const handler = new RegisterVirtualMachineHandler(clusters);
    /* @When register runs referencing an unassigned image */
    /* @Then ImageNotAssigned — the aggregate's pre-condition catches the dangling reference */
    await assertRejects(
      () => handler.handle(aValidCommand(cluster.id.value, node.id.value)),
      ImageNotAssigned,
    );
  });
});
