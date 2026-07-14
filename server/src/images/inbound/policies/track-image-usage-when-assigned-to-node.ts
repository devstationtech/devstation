import type { Policy } from "@server/shared/building-blocks/domain/ports/events/outbound/policy.ts";
import type { ImageAssignedToNode } from "@server/cluster/domain/events/image-assigned-to-node.ts";
import { RecordImageUsage } from "@server/images/application/commands/record-image-usage.ts";
import type { RecordImageUsageHandler } from "@server/images/application/handlers/record-image-usage-handler.ts";

/**
 * Projects a cluster `ImageAssignedToNode` event into the images-context usage
 * record, so the catalog knows which clusters/nodes use each image.
 */
export class TrackImageUsageWhenAssignedToNode implements Policy<ImageAssignedToNode> {
  constructor(private readonly handler: RecordImageUsageHandler) {}

  async on(event: ImageAssignedToNode): Promise<void> {
    await this.handler.handle(
      new RecordImageUsage(
        event.imageId.value,
        event.clusterId.value,
        event.clusterName.value,
        event.nodeId.value,
        event.nodeName.value,
      ),
    );
  }
}
