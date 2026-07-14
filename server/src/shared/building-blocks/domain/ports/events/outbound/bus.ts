import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Type } from "@server/shared/building-blocks/domain/events/type.ts";
import type { Policy } from "@server/shared/building-blocks/domain/ports/events/outbound/policy.ts";
import type { Topic } from "@server/shared/building-blocks/domain/events/topic.ts";

/**
 * Topic-based pub/sub bus for domain events.
 *
 * A topic is the aggregate's wire identity (`<aggregate>.v<n>` —
 * e.g. `new Topic("stations.v1")`). Every event of a given aggregate
 * publishes under the same topic; subscribers must declare the exact
 * event class (`Type<E>`) they want to react to.
 *
 * Topic is set by the outbound `Dispatcher` adapter of the producing BC —
 * application handlers never know about topics. The bus only routes; it
 * doesn't own the topic identity.
 */
export interface Bus {
  /** Publish a domain event under a topic. Routes to subscribers matching `(topic, event.constructor)`. */
  publish<E extends DomainEvent>(topic: Topic, event: E): Promise<void>;

  /**
   * Subscribe a typed policy to a specific event class within a topic.
   * Preserves type narrowing: `policy.on(event: E)` receives the concrete class.
   */
  subscribe<E extends DomainEvent>(
    topic: Topic,
    type: Type<E>,
    policy: Policy<E>,
  ): void;
}
