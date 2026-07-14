import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { UpdateAssignedImageHandler } from "@server/cluster/application/handlers/proxmox/update-assigned-image-handler.ts";
import { UpdateAssignedImage } from "@server/cluster/application/commands/proxmox/update-assigned-image.ts";
import { ImageNotAssigned } from "@server/cluster/domain/exceptions/image-not-assigned.ts";
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
 * UpdateAssignedImageHandler replaces a node's image assignment in
 * place (keeps the imageId, swaps vmid + storage). Pins three
 * branches:
 *  - happy path: vmid and/or storage change; same imageId stays;
 *  - not-assigned: replacing a never-assigned image → ImageNotAssigned;
 *  - vmid-uniqueness: changing to a vmid already used by a SIBLING
 *    assignment on the same node → VirtualMachineIdInUse (changing to the SAME
 *    vmid the assignment already had is a no-op for that check —
 *    only "I want a different number" cases trigger it).
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

function aClusterWithAssignment(
  opts: { imageId: string; virtualMachineId: number; storage: string },
) {
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
  cluster.assignImage(node.id, {
    imageId: { value: opts.imageId },
    virtualMachineId: { value: opts.virtualMachineId },
    storage: { value: opts.storage },
    // deno-lint-ignore no-explicit-any
  } as any);
  return { cluster, node };
}

const IMG = "00000000-0000-0000-0000-0000000000a1";
const IMG_B = "00000000-0000-0000-0000-0000000000a2";

describe("UpdateAssignedImageHandler — happy path", () => {
  it("replaces vmid + storage on the existing assignment (imageId unchanged)", async () => {
    /* @Given a node where image A is assigned with vmid=9001, storage=local-lvm */
    const { cluster, node } = aClusterWithAssignment({
      imageId: IMG,
      virtualMachineId: 9001,
      storage: "local-lvm",
    });
    const { clusters } = fakeClustersWith(cluster);
    const handler = new UpdateAssignedImageHandler(clusters);
    /* @When update runs with new vmid + storage */
    await handler.handle(
      new UpdateAssignedImage(cluster.id.value, node.id.value, IMG, 9050, "local-zfs"),
    );
    /* @Then the assignment carries the new vmid + storage; imageId preserved */
    const after = cluster.nodes.of(node.id).images.byImage({ value: IMG });
    assertEquals(after?.virtualMachineId.value, 9050);
    assertEquals(after?.storage.value, "local-zfs");
    assertEquals(after?.imageId.value, IMG);
  });

  it("keeping the same vmid + storage is a no-op replace (allowed; bumps version)", async () => {
    /* @Given an assignment */
    const { cluster, node } = aClusterWithAssignment({
      imageId: IMG,
      virtualMachineId: 9001,
      storage: "local-lvm",
    });
    const versionBefore = cluster.version.value;
    /* @When the same payload is re-sent */
    const { clusters } = fakeClustersWith(cluster);
    await new UpdateAssignedImageHandler(clusters).handle(
      new UpdateAssignedImage(cluster.id.value, node.id.value, IMG, 9001, "local-lvm"),
    );
    /* @Then the assignment stays as-is, and the aggregate version did bump */
    /*       (replace always bumps — the operator might re-state a desired state) */
    const after = cluster.nodes.of(node.id).images.byImage({ value: IMG });
    assertEquals(after?.virtualMachineId.value, 9001);
    assertEquals(cluster.version.value > versionBefore, true);
  });
});

describe("UpdateAssignedImageHandler — guards", () => {
  it("rejects when the target image is not assigned to the node (ImageNotAssigned)", async () => {
    /* @Given a node WITHOUT an assignment for IMG */
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
    /* (image NOT assigned to the node) */
    const { clusters } = fakeClustersWith(cluster);
    const handler = new UpdateAssignedImageHandler(clusters);
    /* @When update runs */
    /* @Then ImageNotAssigned — must assign before updating */
    await assertRejects(
      () =>
        handler.handle(
          new UpdateAssignedImage(cluster.id.value, node.id.value, IMG, 9001, "local-zfs"),
        ),
      ImageNotAssigned,
    );
  });

  it("rejects changing vmid to one used by a sibling assignment (VirtualMachineIdInUse)", async () => {
    /* @Given a node with TWO assignments: A→9001 and B→9002 */
    const { cluster, node } = aClusterWithAssignment({
      imageId: IMG,
      virtualMachineId: 9001,
      storage: "local-zfs",
    });
    cluster.assignImage(node.id, {
      imageId: { value: IMG_B },
      virtualMachineId: { value: 9002 },
      storage: { value: "local-zfs" },
      // deno-lint-ignore no-explicit-any
    } as any);
    /* @When updating A's vmid to 9002 (sibling's number) */
    const { clusters } = fakeClustersWith(cluster);
    /* @Then VirtualMachineIdInUse — vmid uniqueness preserved across update */
    await assertRejects(
      () =>
        new UpdateAssignedImageHandler(clusters).handle(
          new UpdateAssignedImage(cluster.id.value, node.id.value, IMG, 9002, "local-zfs"),
        ),
      VirtualMachineIdInUse,
    );
  });
});
