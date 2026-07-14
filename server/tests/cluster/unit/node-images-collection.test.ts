import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { NodeImages } from "@server/cluster/domain/models/proxmox/nodes/images/node-images.ts";
import { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";
import { Name as ImageName } from "@server/cluster/domain/models/proxmox/images/name.ts";
import { Source } from "@server/cluster/domain/models/proxmox/images/source.ts";
import { Url } from "@server/cluster/domain/models/proxmox/images/url.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { Storage } from "@server/cluster/domain/models/proxmox/nodes/storage.ts";
import { ImageAlreadyAssigned } from "@server/cluster/domain/exceptions/image-already-assigned.ts";
import { ImageNotAssigned } from "@server/cluster/domain/exceptions/image-not-assigned.ts";
import { VirtualMachineIdInUse } from "@server/cluster/domain/exceptions/virtual-machine-id-in-use.ts";

/**
 * NodeImages tracks per-node image assignments + their template vmid +
 * storage backend. Two invariants pinned: an image is assigned at most
 * once per node, and the template vmid is unique within the node
 * (the template vm-id can't double-up). Collection is immutable —
 * mutating ops return a new instance.
 */

const IMG_A = "00000000-0000-0000-0000-000000000001";
const IMG_B = "00000000-0000-0000-0000-000000000002";

function ni(imageId: string, virtualMachineId = 9000, storage = "local-zfs"): NodeImage {
  return new NodeImage(
    new ImageId(imageId),
    new ImageName("ubuntu"),
    OperatingSystem.UBUNTU_22_04,
    new Source(new Url("https://example.com/ubuntu.img")),
    new VirtualMachineId(virtualMachineId),
    new Storage(storage),
  );
}

describe("NodeImages.assign", () => {
  it("returns a NEW collection with the assigned image", () => {
    /* @Given an empty NodeImages */
    const before = new NodeImages();
    /* @When an image is assigned */
    const after = before.assign(ni(IMG_A, 9001, "local-zfs"));
    /* @Then the new collection has the assignment; the original is unchanged */
    assertEquals(after.length, 1);
    assertEquals(before.length, 0);
    assertEquals(after.byImage({ value: IMG_A })?.virtualMachineId.value, 9001);
  });

  it("rejects assigning the same image twice (ImageAlreadyAssigned)", () => {
    /* @Given an image is already assigned */
    const images = new NodeImages().assign(ni(IMG_A, 9001));
    /* @When the same image is assigned again (different vmid) */
    /* @Then it throws — one image per node */
    assertThrows(
      () => images.assign(ni(IMG_A, 9002)),
      ImageAlreadyAssigned,
    );
  });

  it("rejects when the template vmid collides with an existing assignment (VirtualMachineIdInUse)", () => {
    /* @Given a node where vmid 9001 is already used by image A */
    const images = new NodeImages().assign(ni(IMG_A, 9001));
    /* @When a different image is assigned with the same vmid */
    /* @Then it throws — the template vm-id must be unique per node */
    assertThrows(
      () => images.assign(ni(IMG_B, 9001)),
      VirtualMachineIdInUse,
    );
  });
});

describe("NodeImages.unassign", () => {
  it("returns a NEW collection without the unassigned image", () => {
    const images = new NodeImages().assign(ni(IMG_A, 9001));
    const after = images.unassign(new ImageId(IMG_A));
    assertEquals(after.byImage({ value: IMG_A }), null);
    /* @And the original collection still holds the image (immutable) */
    assertEquals(images.length, 1);
  });

  it("throws ImageNotAssigned when the image is not present", () => {
    const images = new NodeImages();
    assertThrows(
      () => images.unassign(new ImageId(IMG_A)),
      ImageNotAssigned,
    );
  });
});

describe("NodeImages.replace", () => {
  it("replaces in place keeping the same imageId; new vmid + storage are taken", () => {
    /* @Given an image assigned with vmid 9001, storage local-lvm */
    const images = new NodeImages().assign(ni(IMG_A, 9001, "local-lvm"));
    /* @When replace is called with the same imageId, new vmid, new storage */
    const after = images.replace(new ImageId(IMG_A), ni(IMG_A, 9002, "local-zfs"));
    /* @Then the entry is updated in place; size unchanged */
    assertEquals(after.length, 1);
    const got = after.byImage({ value: IMG_A });
    assertEquals(got?.virtualMachineId.value, 9002);
    assertEquals(got?.storage.value, "local-zfs");
  });

  it("rejects replace with a DIFFERENT imageId in the payload (no identity swap)", () => {
    /* @Given an assigned image */
    const images = new NodeImages().assign(ni(IMG_A, 9001));
    /* @When replace targets imageId A but payload carries imageId B */
    /* @Then it throws — replace cannot change which image the slot refers to */
    assertThrows(
      () => images.replace(new ImageId(IMG_A), ni(IMG_B, 9001)),
      Error,
      "imageId",
    );
  });

  it("rejects replace when the new vmid collides with a sibling assignment", () => {
    /* @Given two assignments (A→9001, B→9002) */
    const images = new NodeImages()
      .assign(ni(IMG_A, 9001))
      .assign(ni(IMG_B, 9002));
    /* @When replacing A's vmid to 9002 (sibling's) */
    /* @Then VirtualMachineIdInUse — uniqueness preserved across update */
    assertThrows(
      () => images.replace(new ImageId(IMG_A), ni(IMG_A, 9002)),
      VirtualMachineIdInUse,
    );
  });

  it("rejects replace of a non-existent image (ImageNotAssigned)", () => {
    const images = new NodeImages();
    assertThrows(
      () => images.replace(new ImageId(IMG_A), ni(IMG_A, 9001)),
      ImageNotAssigned,
    );
  });
});

describe("NodeImages — lookup + items", () => {
  it("byImage / byVirtualMachineId return null on miss (used by the assign uniqueness checks)", () => {
    const images = new NodeImages();
    assertEquals(images.byImage({ value: IMG_A }), null);
    assertEquals(images.byVirtualMachineId(new VirtualMachineId(9999)), null);
  });

  it("items returns a shallow copy — mutating it does NOT mutate the collection", () => {
    const images = new NodeImages().assign(ni(IMG_A, 9001));
    const snapshot = images.items;
    (snapshot as unknown as { length: number }).length = 0;
    assertEquals(images.length, 1);
  });

  it("clear() returns an empty collection without mutating the original", () => {
    const images = new NodeImages().assign(ni(IMG_A, 9001));
    const empty = images.clear();
    assertEquals(empty.length, 0);
    assertEquals(images.length, 1);
  });
});
