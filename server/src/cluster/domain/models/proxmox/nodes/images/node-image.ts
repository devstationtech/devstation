import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import type { Name as ImageName } from "@server/cluster/domain/models/proxmox/images/name.ts";
import type { Source } from "@server/cluster/domain/models/proxmox/images/source.ts";
import type { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import type { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import type { Storage } from "@server/cluster/domain/models/proxmox/nodes/storage.ts";

/**
 * An image materialized (or to-be-materialized) as a template on a node:
 * the operator-chosen template VMID + storage, plus a point-in-time snapshot
 * of the catalog image (name, os, source) taken at assign time. The snapshot
 * makes the node self-sufficient — deleting the image from the central catalog
 * never strands an already-assigned node.
 */
export class NodeImage implements ValueObject {
  constructor(
    readonly imageId: ImageId,
    readonly name: ImageName,
    readonly os: OperatingSystem,
    readonly source: Source,
    readonly virtualMachineId: VirtualMachineId,
    readonly storage: Storage,
  ) {}
}
