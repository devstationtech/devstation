import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";

/**
 * Outbound port: each BC implements this in its `outbound/` layer.
 *
 * The application handler accumulates domain events on the aggregate and
 * hands them off to a `Dispatcher` after persisting the aggregate. The
 * BC's `Dispatcher` adapter knows the topic identity of its aggregate
 * (e.g. `"stations.v1"`) and translates each event into a wire-format
 * payload before publishing on the bus. Handlers stay unaware of
 * topics, schemas, or the wire.
 */
export interface Dispatcher {
  dispatch(events: readonly DomainEvent[]): Promise<void>;
}
