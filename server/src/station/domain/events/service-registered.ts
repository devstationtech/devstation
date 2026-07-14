import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { EventId } from "@server/shared/building-blocks/domain/events/event-id.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Id } from "@server/station/domain/models/service/id.ts";
import type { StationId } from "@server/station/domain/models/service/station-id.ts";
import type { Name } from "@server/station/domain/models/service/name.ts";
import type { BlueprintName } from "@server/station/domain/models/service/blueprint-name.ts";
import type { Instance } from "@server/station/domain/models/service/instance.ts";
import type { Host } from "@server/station/domain/models/service/host.ts";

export class ServiceRegistered implements DomainEvent {
  readonly eventId = new EventId();
  readonly occurredAt = new Instant();

  constructor(
    readonly serviceId: Id,
    readonly stationId: StationId,
    readonly name: Name,
    readonly blueprint: BlueprintName,
    readonly instances: readonly Instance[],
    readonly host: Host | null,
  ) {}
}
