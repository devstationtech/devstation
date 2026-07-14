import { Aggregate } from "@server/shared/building-blocks/domain/models/aggregate.ts";
import type { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import type { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import type { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import type { Id } from "@server/images/domain/models/id.ts";
import type { Name } from "@server/images/domain/models/name.ts";
import type { Source } from "@server/images/domain/models/source.ts";

/**
 * Catalog entry for a bootable OS image: a name, the OS it installs and the
 * source URL of the ISO / cloud image. Pure metadata — materializing a
 * template on a Proxmox node is the cluster context's concern.
 */
export class Image extends Aggregate {
  constructor(
    readonly id: Id,
    readonly name: Name,
    readonly os: OperatingSystem,
    readonly source: Source,
    creation: Creation,
    version?: Version,
  ) {
    super(creation, version);
  }

  static register(
    id: Id,
    name: Name,
    os: OperatingSystem,
    source: Source,
    creation: Creation,
  ): Image {
    return new Image(id, name, os, source, creation);
  }

  update(name: Name, os: OperatingSystem, source: Source): Image {
    return new Image(this.id, name, os, source, this.creation, this.version);
  }
}
