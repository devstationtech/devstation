import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";

/**
 * Reaction defined by a consumer context to an event published by another
 * context. The policy reads the foreign event and translates it into a
 * command of its own context — never calls another context directly.
 *
 * Subscription happens at the composition root via
 * `bus.subscribe(topic, Type, policy)` — the topic is the producing
 * aggregate's wire identity (e.g. `new Topic("stations.v1")`).
 */
export interface Policy<E extends DomainEvent> {
  on(event: E): Promise<void>;
}
