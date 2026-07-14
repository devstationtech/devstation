import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { EventId } from "@server/shared/building-blocks/domain/events/event-id.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Id as ClusterId } from "@server/cluster/domain/models/id.ts";
import type { Name as ClusterName } from "@server/cluster/domain/models/name.ts";
import type { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { Name as NodeName } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import type { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";

/**
 * A catalog image was assigned to a node as a template. Carries the cluster +
 * node display names so the `images` context can project usage ("which
 * clusters/nodes use this image") without crossing back into the cluster
 * domain.
 */
export class ImageAssignedToNode implements DomainEvent {
  readonly eventId = new EventId();
  readonly occurredAt = new Instant();

  constructor(
    readonly clusterId: ClusterId,
    readonly clusterName: ClusterName,
    readonly nodeId: NodeId,
    readonly nodeName: NodeName,
    readonly imageId: ImageId,
  ) {}
}
