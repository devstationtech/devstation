import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Bus } from "@server/shared/building-blocks/domain/ports/events/outbound/bus.ts";
import { Topic } from "@server/shared/building-blocks/domain/events/topic.ts";

/**
 * Outbound dispatcher for the cluster BC.
 *
 * Application handlers hand it the events accumulated on the aggregate
 * after `clusters.save()`. This adapter knows the topic identity of the
 * Cluster aggregate (`clusters.v1`) and publishes each event on the bus
 * under that topic.
 */
export class Adapter implements Dispatcher {
  static readonly TOPIC: Topic = new Topic("clusters.v1");

  constructor(private readonly bus: Bus) {}

  async dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.bus.publish(Adapter.TOPIC, event);
    }
  }
}
