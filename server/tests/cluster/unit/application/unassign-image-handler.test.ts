import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { UnassignImageHandler } from "@server/cluster/application/handlers/proxmox/unassign-image-handler.ts";
import { UnassignImage } from "@server/cluster/application/commands/proxmox/unassign-image.ts";
import { ImageNotAssigned } from "@server/cluster/domain/exceptions/image-not-assigned.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { nodeImage, registerNode, virtualMachine } from "@tests/cluster/fixtures/operations.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

/**
 * UnassignImageHandler removes a node's assigned image. Pins three
 * branches:
 *  - happy: assignment is removed; image catalog entry stays (image
 *    can be re-assigned to another node);
 *  - in-use guard: a VM on the node references this image →
 *    rejection (must remove the VM first; the aggregate's
 *    requireImageNotReferencedByVirtualMachines guard);
 *  - not-assigned: unassigning an image that was never assigned →
 *    ImageNotAssigned (delegated from NodeImages.unassign).
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

function aCluster(): ProxmoxCluster {
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

const IMG_A = "00000000-0000-0000-0000-0000000090a0"; // matches the default in `image()` + `nodeImage()` fixtures

describe("UnassignImageHandler — happy path", () => {
  it("removes the node's assigned image", async () => {
    /* @Given a cluster with a node, image registered + assigned, no VMs referencing it */
    const cluster = aCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    /* @When unassign runs */
    const { clusters } = fakeClustersWith(cluster);
    await new UnassignImageHandler(clusters).handle(
      new UnassignImage(cluster.id.value, node.id.value, IMG_A),
    );
    /* @Then the node has no assignments */
    assertEquals(cluster.nodes.of(node.id).images.length, 0);
  });
});

describe("UnassignImageHandler — in-use guard", () => {
  it("rejects when a VM on the node still references the image", async () => {
    /* @Given a node + image assigned + a VM referencing the assigned image */
    const cluster = aCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    cluster.assignImage(node.id, nodeImage());
    cluster.registerVirtualMachine(node.id, virtualMachine(101, "10.0.0.101"));
    /* @When unassign runs */
    /* @Then it throws — the in-use guard prevents leaving orphaned VMs (must remove the VM first) */
    const { clusters } = fakeClustersWith(cluster);
    await assertRejects(
      () =>
        new UnassignImageHandler(clusters).handle(
          new UnassignImage(cluster.id.value, node.id.value, IMG_A),
        ),
      Error,
    );
    /* @And the assignment is still present (cluster integrity preserved) */
    assertEquals(cluster.nodes.of(node.id).images.length, 1);
  });
});

describe("UnassignImageHandler — not-assigned guard", () => {
  it("rejects unassigning an image that was never assigned (ImageNotAssigned)", async () => {
    /* @Given a node with NO image assigned */
    const cluster = aCluster();
    const node = registerNode("cp4", "192.168.15.194");
    cluster.registerNode(node);
    /* @When unassign runs */
    /* @Then ImageNotAssigned bubbles up — same exception NodeImages.unassign would raise */
    const { clusters } = fakeClustersWith(cluster);
    await assertRejects(
      () =>
        new UnassignImageHandler(clusters).handle(
          new UnassignImage(cluster.id.value, node.id.value, IMG_A),
        ),
      ImageNotAssigned,
    );
  });
});
