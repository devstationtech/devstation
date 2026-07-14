import type { UnregisterImage } from "@server/images/application/commands/unregister-image.ts";
import type { Images } from "@server/images/domain/ports/outbound/images.ts";
import { Id } from "@server/images/domain/models/id.ts";

export class UnregisterImageHandler {
  constructor(private readonly images: Images) {}

  async handle(command: UnregisterImage): Promise<void> {
    await this.images.remove(new Id(command.id));
  }
}
