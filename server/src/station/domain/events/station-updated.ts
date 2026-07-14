import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { EventId } from "@server/shared/building-blocks/domain/events/event-id.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Id } from "@server/station/domain/models/id.ts";
import type { Name } from "@server/station/domain/models/name.ts";
import type { Description } from "@server/station/domain/models/description.ts";

export class StationUpdated implements DomainEvent {
  readonly eventId = new EventId();
  readonly occurredAt = new Instant();

  constructor(
    readonly stationId: Id,
    readonly name: Name,
    readonly description: Description,
  ) {}
}
