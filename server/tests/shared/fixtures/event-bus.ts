import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";

/**
 * Recording Dispatcher double — captures every dispatched event into `events`
 * so tests can assert which events were published and in what order.
 * Used in place of the production `<bc>/outbound/dispatcher-adapter.ts`
 * in handler tests where the goal is to verify the events accumulated on
 * the aggregate, not the bus routing.
 */
export class TestEventBus implements Dispatcher {
  readonly events: DomainEvent[] = [];

  dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) this.events.push(event);
    return Promise.resolve();
  }
}
