import type { Policy } from "@server/shared/building-blocks/domain/ports/events/outbound/policy.ts";
import type { ImageUnassignedFromNode } from "@server/cluster/domain/events/image-unassigned-from-node.ts";
import { ForgetImageUsage } from "@server/images/application/commands/forget-image-usage.ts";
import type { ForgetImageUsageHandler } from "@server/images/application/handlers/forget-image-usage-handler.ts";

/**
 * Drops the usage record when a cluster unassigns an image template from a node.
 */
export class ForgetImageUsageWhenUnassignedFromNode implements Policy<ImageUnassignedFromNode> {
  constructor(private readonly handler: ForgetImageUsageHandler) {}

  async on(event: ImageUnassignedFromNode): Promise<void> {
    await this.handler.handle(
      new ForgetImageUsage(event.imageId.value, event.clusterId.value, event.nodeId.value),
    );
  }
}
