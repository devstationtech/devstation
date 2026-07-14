import type { UpdateImage } from "@server/images/application/commands/update-image.ts";
import type { Images } from "@server/images/domain/ports/outbound/images.ts";
import { Id } from "@server/images/domain/models/id.ts";
import { Name } from "@server/images/domain/models/name.ts";
import { Source } from "@server/images/domain/models/source.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Url } from "@server/images/domain/models/url.ts";

export class UpdateImageHandler {
  constructor(private readonly images: Images) {}

  async handle(command: UpdateImage): Promise<void> {
    const image = await this.images.of(new Id(command.id));
    const updated = image.update(
      new Name(command.name),
      OperatingSystem.from(command.os),
      new Source(new Url(command.sourceUrl)),
    );
    await this.images.update(updated);
  }
}
