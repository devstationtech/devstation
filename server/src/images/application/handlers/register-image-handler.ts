import type { RegisterImage } from "@server/images/application/commands/register-image.ts";
import type { Images } from "@server/images/domain/ports/outbound/images.ts";
import { Image } from "@server/images/domain/models/image.ts";
import { Id } from "@server/images/domain/models/id.ts";
import { Name } from "@server/images/domain/models/name.ts";
import { Source } from "@server/images/domain/models/source.ts";
import { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Url } from "@server/images/domain/models/url.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { ImageAlreadyExists } from "@server/images/domain/exceptions/image-already-exists.ts";

export class RegisterImageHandler {
  constructor(private readonly images: Images) {}

  /** Returns the freshly-minted image id so MCP inbound can echo it. */
  async handle(command: RegisterImage): Promise<{ imageId: string }> {
    const name = new Name(command.name);
    if (await this.images.exists(name)) throw new ImageAlreadyExists();

    const image = Image.register(
      new Id(),
      name,
      OperatingSystem.from(command.os),
      new Source(new Url(command.sourceUrl)),
      new Creation(new User(command.user), new Hostname(command.host), new Instant()),
    );
    await this.images.add(image);
    return { imageId: image.id.value };
  }
}
