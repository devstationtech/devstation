import type { ForgetImageUsage } from "@server/images/application/commands/forget-image-usage.ts";
import type { ImageUsages } from "@server/images/domain/ports/outbound/image-usages.ts";
import { Id } from "@server/images/domain/models/id.ts";

export class ForgetImageUsageHandler {
  constructor(private readonly usages: ImageUsages) {}

  async handle(command: ForgetImageUsage): Promise<void> {
    await this.usages.forget(new Id(command.imageId), command.clusterId, command.nodeId);
  }
}
