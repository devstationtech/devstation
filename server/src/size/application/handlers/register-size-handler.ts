import type { RegisterSize } from "@server/size/application/commands/register-size.ts";
import type { Sizes } from "@server/size/domain/ports/outbound/sizes.ts";
import { SizeFactory } from "@server/size/application/factories/size-factory.ts";
import { Name } from "@server/size/domain/models/name.ts";
import { SizeAlreadyExists } from "@server/size/domain/exceptions/size-already-exists.ts";

export class RegisterSizeHandler {
  constructor(private readonly sizes: Sizes) {}

  /**
   * Returns the freshly-minted size id so MCP inbound can echo
   * it to the LLM caller without a list round-trip.
   */
  async handle(command: RegisterSize): Promise<{ sizeId: string }> {
    const name = new Name(command.name);

    if (await this.sizes.exists(name)) {
      throw new SizeAlreadyExists();
    }

    const size = SizeFactory.build(command);
    await this.sizes.add(size);
    return { sizeId: size.id.value };
  }
}
