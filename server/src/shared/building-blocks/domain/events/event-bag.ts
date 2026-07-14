import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";

/**
 * In-memory queue of domain events an aggregate has produced since the last
 * drain. Owned by `Aggregate`; subclasses push, callers pull.
 *
 * `pull()` returns the accumulated events and clears the queue in a single
 * step — guarantees the same event isn't dispatched twice and keeps the
 * aggregate's internal buffer immutable from the outside.
 */
export class EventBag {
  private readonly items: DomainEvent[] = [];

  push(event: DomainEvent): void {
    this.items.push(event);
  }

  pull(): DomainEvent[] {
    const drained = [...this.items];
    this.items.length = 0;
    return drained;
  }

  get size(): number {
    return this.items.length;
  }
}
