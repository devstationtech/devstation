import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { EventId } from "@server/shared/building-blocks/domain/events/event-id.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Id as ClusterId } from "@server/cluster/domain/models/id.ts";
import type { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";

export class NodeDestroyStarted implements DomainEvent {
  readonly eventId = new EventId();
  readonly occurredAt = new Instant();

  constructor(readonly clusterId: ClusterId, readonly nodeId: NodeId) {}
}
