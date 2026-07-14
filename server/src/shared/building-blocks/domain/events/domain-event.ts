import type { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { EventId } from "@server/shared/building-blocks/domain/events/event-id.ts";

/**
 * A fact that happened in a bounded context. Immutable, identified, timestamped.
 *
 * Domain primitive (alongside `Aggregate`, `EventBag`, `ValueObject`).
 * Concrete events live in the producing context's `domain/events/` directory
 * and carry the minimal payload required for consumers (typically references,
 * not duplicated data). The event name for traceability is derived from the
 * concrete class via `event.constructor.name` — sufficient while the bus is
 * in-process and the runtime is not minified.
 */
export interface DomainEvent {
  readonly eventId: EventId;
  readonly occurredAt: Instant;
}
