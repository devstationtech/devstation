import type { RecordImageUsage } from "@server/images/application/commands/record-image-usage.ts";
import type { ImageUsages } from "@server/images/domain/ports/outbound/image-usages.ts";
import { Id } from "@server/images/domain/models/id.ts";
import { ImageUsage } from "@server/images/domain/models/usage/image-usage.ts";

export class RecordImageUsageHandler {
  constructor(private readonly usages: ImageUsages) {}

  async handle(command: RecordImageUsage): Promise<void> {
    await this.usages.record(
      new ImageUsage(
        new Id(command.imageId),
        command.clusterId,
        command.clusterName,
        command.nodeId,
        command.nodeName,
      ),
    );
  }
}
