import { Aggregate } from "@server/shared/building-blocks/domain/models/aggregate.ts";
import type { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import type { Size } from "@server/size/domain/models/size.ts";
import type { Id } from "@server/size/domain/models/id.ts";
import type { Name } from "@server/size/domain/models/name.ts";
import { Provider } from "@server/shared/building-blocks/domain/models/value-objects/provider.ts";
import type { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import type { Cpu } from "@server/size/domain/models/proxmox/cpu.ts";
import type { Ram } from "@server/size/domain/models/proxmox/ram.ts";
import type { Disk } from "@server/size/domain/models/proxmox/disk.ts";

export class ProxmoxSize extends Aggregate implements Size {
  readonly provider = Provider.PROXMOX;

  constructor(
    readonly id: Id,
    readonly name: Name,
    readonly cpu: Cpu,
    readonly ram: Ram,
    readonly disk: Disk,
    creation: Creation,
    version?: Version,
  ) {
    super(creation, version);
  }

  static register(
    id: Id,
    name: Name,
    cpu: Cpu,
    ram: Ram,
    disk: Disk,
    creation: Creation,
  ): ProxmoxSize {
    return new ProxmoxSize(id, name, cpu, ram, disk, creation);
  }
}
