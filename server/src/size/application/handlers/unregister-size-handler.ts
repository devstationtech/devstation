import { Id } from "@server/size/domain/models/id.ts";
import type { UnregisterSize } from "@server/size/application/commands/unregister-size.ts";
import type { Sizes } from "@server/size/domain/ports/outbound/sizes.ts";

export class UnregisterSizeHandler {
  constructor(private readonly sizes: Sizes) {}

  async handle(command: UnregisterSize): Promise<void> {
    await this.sizes.remove(new Id(command.id));
  }
}
