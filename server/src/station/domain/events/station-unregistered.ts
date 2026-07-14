import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { EventId } from "@server/shared/building-blocks/domain/events/event-id.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Id } from "@server/station/domain/models/id.ts";

export class StationUnregistered implements DomainEvent {
  readonly eventId = new EventId();
  readonly occurredAt = new Instant();

  constructor(readonly stationId: Id) {}
}
