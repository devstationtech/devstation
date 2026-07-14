import type { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";
import type { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import type { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { ImageNotAssigned } from "@server/cluster/domain/exceptions/image-not-assigned.ts";
import { ImageAlreadyAssigned } from "@server/cluster/domain/exceptions/image-already-assigned.ts";
import { VirtualMachineIdInUse } from "@server/cluster/domain/exceptions/virtual-machine-id-in-use.ts";

export class NodeImages {
  constructor(private readonly _items: NodeImage[] = []) {}

  get items(): readonly NodeImage[] {
    return [...this._items];
  }

  get length(): number {
    return this._items.length;
  }

  byImage(id: { value: string }): NodeImage | null {
    return this._items.find((t) => t.imageId.value === id.value) ?? null;
  }

  byVirtualMachineId(virtualMachineId: VirtualMachineId): NodeImage | null {
    return this._items.find((t) => t.virtualMachineId.value === virtualMachineId.value) ?? null;
  }

  of(id: { value: string }): NodeImage {
    const t = this.byImage(id);
    if (!t) throw new ImageNotAssigned(id.value);
    return t;
  }

  assign(nodeImage: NodeImage): NodeImages {
    if (this.byImage(nodeImage.imageId)) {
      throw new ImageAlreadyAssigned(nodeImage.imageId.value);
    }
    if (this.byVirtualMachineId(nodeImage.virtualMachineId)) {
      throw new VirtualMachineIdInUse(nodeImage.virtualMachineId.value);
    }
    return new NodeImages([...this._items, nodeImage]);
  }

  unassign(id: ImageId): NodeImages {
    if (!this.byImage(id)) throw new ImageNotAssigned(id.value);
    return new NodeImages(this._items.filter((t) => t.imageId.value !== id.value));
  }

  replace(id: ImageId, nodeImage: NodeImage): NodeImages {
    if (!this.byImage(id)) throw new ImageNotAssigned(id.value);
    if (nodeImage.imageId.value !== id.value) {
      throw new Error("cannot change imageId via replace");
    }
    const conflict = this.byVirtualMachineId(nodeImage.virtualMachineId);
    if (conflict && conflict.imageId.value !== id.value) {
      throw new VirtualMachineIdInUse(nodeImage.virtualMachineId.value);
    }
    return new NodeImages(
      this._items.map((t) => t.imageId.value === id.value ? nodeImage : t),
    );
  }

  clear(): NodeImages {
    return new NodeImages();
  }
}
