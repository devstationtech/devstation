import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Cpu } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/cpu.ts";
import type { Ram } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/ram.ts";
import type { Disk } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/disk.ts";

export class ProxmoxResources implements ValueObject {
  constructor(
    readonly cpu: Cpu,
    readonly ram: Ram,
    readonly disk: Disk,
  ) {}
}
