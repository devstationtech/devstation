import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { Size } from "@server/size/domain/models/size.ts";
import { ProxmoxSize } from "@server/size/domain/models/proxmox/proxmox-size.ts";
import { Id } from "@server/size/domain/models/id.ts";
import { Name } from "@server/size/domain/models/name.ts";
import { Provider } from "@server/shared/building-blocks/domain/models/value-objects/provider.ts";
import { Cpu } from "@server/size/domain/models/proxmox/cpu.ts";
import { Ram } from "@server/size/domain/models/proxmox/ram.ts";
import { Disk } from "@server/size/domain/models/proxmox/disk.ts";
import { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Sizes } from "@server/size/domain/ports/outbound/sizes.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import { SizeNotFound } from "@server/size/domain/exceptions/size-not-found.ts";
import { UnsupportedProvider } from "@server/size/domain/exceptions/unsupported-provider.ts";

const FILENAME = "sizes.json";

export class Adapter implements Sizes {
  constructor(
    private readonly fs: FileSystem,
    private readonly logger: Logger,
  ) {}

  async of(id: Id): Promise<Size> {
    const sizes = await this.readAll();
    const size = sizes.find((d) => d.id.value === id.value);
    if (!size) throw new SizeNotFound();
    return size;
  }

  async add(size: Size): Promise<void> {
    const sizes = await this.readAll();
    await this.fs.writeObjectsOf(FILENAME, this.serializeAll([...sizes, size]));
  }

  async remove(id: Id): Promise<void> {
    const sizes = await this.readAll();
    const next = sizes.filter((d) => d.id.value !== id.value);
    if (next.length === sizes.length) throw new SizeNotFound();
    await this.fs.writeObjectsOf(FILENAME, this.serializeAll(next));
  }

  async exists(name: Name): Promise<boolean> {
    const sizes = await this.readAll();
    return sizes.some((d) => d.name.value === name.value);
  }

  private async readAll(): Promise<Size[]> {
    const records = await this.fs.readObjectsOf<Record<string, unknown>>(FILENAME);
    return this.unserialize(records);
  }

  private unserialize(records: Record<string, unknown>[]): Size[] {
    return records.map((record) => {
      const creation = record.creation as Record<string, string>;
      const base = {
        id: new Id(record.id as string),
        name: new Name(record.name as string),
        version: new Version(record.version as number),
        creation: new Creation(
          new User(creation.by),
          new Hostname(creation.hostname),
          Instant.fromString(creation.at),
        ),
      };

      if (record.provider === Provider.PROXMOX) {
        return new ProxmoxSize(
          base.id,
          base.name,
          new Cpu(record.cpu as number),
          new Ram(record.ram as number),
          new Disk(record.disk as number),
          base.creation,
          base.version,
        );
      }

      throw new UnsupportedProvider(record.provider as string);
    });
  }

  private serializeAll(sizes: Size[]): Record<string, unknown>[] {
    return sizes.map((def) => {
      if (def instanceof ProxmoxSize) {
        return {
          id: def.id.value,
          name: def.name.value,
          provider: def.provider,
          version: def.version.value,
          cpu: def.cpu.value,
          ram: def.ram.value,
          disk: def.disk.value,
          creation: {
            by: def.creation.by.value,
            hostname: def.creation.hostname.value,
            at: def.creation.at.toString(),
          },
        };
      }
      throw new UnsupportedProvider(def.provider as string);
    });
  }
}
