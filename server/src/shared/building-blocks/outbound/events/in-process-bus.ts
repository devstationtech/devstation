import type { Bus } from "@server/shared/building-blocks/domain/ports/events/outbound/bus.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Type } from "@server/shared/building-blocks/domain/events/type.ts";
import type { Policy } from "@server/shared/building-blocks/domain/ports/events/outbound/policy.ts";
import type { Topic } from "@server/shared/building-blocks/domain/events/topic.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";

const ORIGIN = "event-bus";

const keyOf = (topic: Topic, type: Type<DomainEvent>): string => `${topic.value}::${type.name}`;

/**
 * Synchronous in-process event bus. Topic-based routing.
 *
 * Subscriptions are keyed by `(topic, Type)` — each subscriber declares
 * the exact event class it reacts to within a topic. Cross-event
 * forwarding is the subscriber's responsibility (subscribe one class at
 * a time).
 *
 * On `publish(topic, event)`, the bus invokes every policy that matches
 * `(topic, event.constructor)`. Errors propagate by default; the caller
 * decides whether to swallow or fail loudly. Each publish and each
 * subscriber hit is logged.
 */
export class InProcessBus implements Bus {
  private readonly subscriptions = new Map<string, Policy<DomainEvent>[]>();

  constructor(private readonly logger: Logger) {}

  subscribe<E extends DomainEvent>(
    topic: Topic,
    type: Type<E>,
    policy: Policy<E>,
  ): void {
    const key = keyOf(topic, type as Type<DomainEvent>);
    const list = this.subscriptions.get(key) ?? [];
    list.push(policy as Policy<DomainEvent>);
    this.subscriptions.set(key, list);
  }

  async publish<E extends DomainEvent>(topic: Topic, event: E): Promise<void> {
    const type = event.constructor as Type<DomainEvent>;
    const subscribers = this.subscriptions.get(keyOf(topic, type)) ?? [];

    await this.logger.info(
      ORIGIN,
      `publish ${topic.value}::${type.name} (${event.eventId.value}) → ${subscribers.length} subscriber(s)`,
    );

    for (const policy of subscribers) {
      const tag = policy.constructor.name;
      try {
        await policy.on(event);
        await this.logger.info(ORIGIN, `${tag} handled ${type.name} on ${topic.value}`);
      } catch (cause) {
        await this.logger.error(ORIGIN, `${tag} failed on ${type.name} (${topic.value})`, cause);
        throw cause;
      }
    }
  }
}
