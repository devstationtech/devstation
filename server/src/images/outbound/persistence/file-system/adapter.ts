import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Image } from "@server/images/domain/models/image.ts";
import { Id } from "@server/images/domain/models/id.ts";
import { Name } from "@server/images/domain/models/name.ts";
import { Source } from "@server/images/domain/models/source.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Url } from "@server/images/domain/models/url.ts";
import { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Images } from "@server/images/domain/ports/outbound/images.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import { ImageNotFound } from "@server/images/domain/exceptions/image-not-found.ts";

const FILENAME = "images.json";

export class Adapter implements Images {
  constructor(
    private readonly fs: FileSystem,
    private readonly logger: Logger,
  ) {}

  async of(id: Id): Promise<Image> {
    const images = await this.readAll();
    const image = images.find((i) => i.id.value === id.value);
    if (!image) throw new ImageNotFound();
    return image;
  }

  async add(image: Image): Promise<void> {
    const images = await this.readAll();
    await this.fs.writeObjectsOf(FILENAME, this.serializeAll([...images, image]));
  }

  async update(image: Image): Promise<void> {
    const images = await this.readAll();
    const index = images.findIndex((i) => i.id.value === image.id.value);
    if (index === -1) throw new ImageNotFound();
    images[index] = image;
    await this.fs.writeObjectsOf(FILENAME, this.serializeAll(images));
  }

  async remove(id: Id): Promise<void> {
    const images = await this.readAll();
    const next = images.filter((i) => i.id.value !== id.value);
    if (next.length === images.length) throw new ImageNotFound();
    await this.fs.writeObjectsOf(FILENAME, this.serializeAll(next));
  }

  async exists(name: Name): Promise<boolean> {
    const images = await this.readAll();
    return images.some((i) => i.name.value === name.value);
  }

  private async readAll(): Promise<Image[]> {
    const records = await this.fs.readObjectsOf<Record<string, unknown>>(FILENAME);
    return records.map((record) => {
      const creation = record.creation as Record<string, string>;
      return new Image(
        new Id(record.id as string),
        new Name(record.name as string),
        OperatingSystem.from(record.os as string),
        new Source(new Url(record.sourceUrl as string)),
        new Creation(
          new User(creation.by),
          new Hostname(creation.hostname),
          Instant.fromString(creation.at),
        ),
        new Version(record.version as number),
      );
    });
  }

  private serializeAll(images: Image[]): Record<string, unknown>[] {
    return images.map((image) => ({
      id: image.id.value,
      name: image.name.value,
      os: image.os,
      sourceUrl: image.source.url.value,
      version: image.version.value,
      creation: {
        by: image.creation.by.value,
        hostname: image.creation.hostname.value,
        at: image.creation.at.toString(),
      },
    }));
  }
}
