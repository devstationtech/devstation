import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { AssignImageHandler } from "@server/cluster/application/handlers/proxmox/assign-image-handler.ts";
import { AssignImage } from "@server/cluster/application/commands/proxmox/assign-image.ts";
import { ImageAlreadyAssigned } from "@server/cluster/domain/exceptions/image-already-assigned.ts";
import { VirtualMachineIdInUse } from "@server/cluster/domain/exceptions/virtual-machine-id-in-use.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { registerNode } from "@tests/cluster/fixtures/operations.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

/**
 * AssignImageHandler attaches an image (with its catalog snapshot) + vmid +
 * storage to a node. Delegates to ProxmoxCluster.assignImage which enforces:
 *  - one image-per-node uniqueness;
 *  - template vmid uniqueness within the node.
 *
 * The central catalog lives in the `images` context now; the caller passes a
 * point-in-time snapshot (name/os/sourceUrl) that the node keeps.
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

function aProxmoxCluster(): ProxmoxCluster {
  return ProxmoxCluster.register(
    new Id(),
    new Name("homelab"),
    new Creation(
      new User("alice"),
      new Hostname("workstation"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
}

const IMG_A = "00000000-0000-0000-0000-0000000000a1";
const IMG_B = "00000000-0000-0000-0000-0000000000a2";
const URL = "https://example.com/ubuntu.img";

function assign(
  clusterId: string,
  nodeId: string,
  imageId: string,
  vmid: number,
  storage: string,
): AssignImage {
  return new AssignImage(
    clusterId,
    nodeId,
    imageId,
    vmid,
    storage,
    "ubuntu-22",
    "ubuntu-22-04",
    URL,
  );
}

describe("AssignImageHandler — happy path", () => {
  it("assigns an image to a node with the given vmid + storage + snapshot", async () => {
    /* @Given a cluster with a node */
    const cluster = aProxmoxCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    const { clusters } = fakeClustersWith(cluster);
    const handler = new AssignImageHandler(clusters);

    /* @When assign runs */
    await handler.handle(assign(cluster.id.value, node.id.value, IMG_A, 9001, "local-zfs"));

    /* @Then the node carries the assignment with vmid + storage + snapshot */
    const got = cluster.nodes.of(node.id).images.byImage({ value: IMG_A });
    assertEquals(got?.virtualMachineId.value, 9001);
    assertEquals(got?.storage.value, "local-zfs");
    assertEquals(got?.name.value, "ubuntu-22");
  });
});

describe("AssignImageHandler — uniqueness invariants", () => {
  it("rejects assigning the same image twice on the same node (ImageAlreadyAssigned)", async () => {
    /* @Given a cluster with a node and image already assigned */
    const cluster = aProxmoxCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    const { clusters } = fakeClustersWith(cluster);
    const handler = new AssignImageHandler(clusters);
    await handler.handle(assign(cluster.id.value, node.id.value, IMG_A, 9001, "local-zfs"));
    /* @When assign runs again for the same image */
    /* @Then ImageAlreadyAssigned (one image per node) */
    await assertRejects(
      () => handler.handle(assign(cluster.id.value, node.id.value, IMG_A, 9002, "local-zfs")),
      ImageAlreadyAssigned,
    );
  });

  it("rejects assigning a different image with a colliding template vmid (VirtualMachineIdInUse)", async () => {
    /* @Given image A already assigned with vmid 9001 */
    const cluster = aProxmoxCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    const { clusters } = fakeClustersWith(cluster);
    const handler = new AssignImageHandler(clusters);
    await handler.handle(assign(cluster.id.value, node.id.value, IMG_A, 9001, "local-zfs"));
    /* @When image B is assigned with the SAME vmid 9001 */
    /* @Then VirtualMachineIdInUse (template vm-id must be unique per node) */
    await assertRejects(
      () => handler.handle(assign(cluster.id.value, node.id.value, IMG_B, 9001, "local-zfs")),
      VirtualMachineIdInUse,
    );
  });
});
