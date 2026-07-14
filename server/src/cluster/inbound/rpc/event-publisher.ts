import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { ClusterEvent } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import {
  NodeApplyFailedV1,
  NodeApplyStartedV1,
  NodeApplySucceededV1,
  NodeDestroyFailedV1,
  NodeDestroyStartedV1,
  NodeDestroySucceededV1,
  NodePlanFailedV1,
  NodePlanStartedV1,
  NodePlanSucceededV1,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { NodePlanStarted } from "@server/cluster/domain/events/node-plan-started.ts";
import { NodePlanSucceeded } from "@server/cluster/domain/events/node-plan-succeeded.ts";
import { NodePlanFailed } from "@server/cluster/domain/events/node-plan-failed.ts";
import { NodeApplyStarted } from "@server/cluster/domain/events/node-apply-started.ts";
import { NodeApplySucceeded } from "@server/cluster/domain/events/node-apply-succeeded.ts";
import { NodeApplyFailed } from "@server/cluster/domain/events/node-apply-failed.ts";
import { NodeDestroyStarted } from "@server/cluster/domain/events/node-destroy-started.ts";
import { NodeDestroySucceeded } from "@server/cluster/domain/events/node-destroy-succeeded.ts";
import { NodeDestroyFailed } from "@server/cluster/domain/events/node-destroy-failed.ts";
import type { ClusterEventSink } from "@server/cluster/inbound/rpc/cluster-event-sink.ts";

/**
 * Binds a cluster domain event to its versioned wire class and hands it
 * to the sink for delivery to `cluster.subscribe` watchers.
 *
 * Lives at the bus→UI edge: the in-process bus stays domain-typed;
 * this publisher subscribes to the 9 cluster domain events and
 * translates each to its `*V1` contract class. The bind is mandatory
 * here — letting the transport serialize the raw domain event would
 * leak VO internals (`EventId`/`Instant`/`Id`); the `*V1` carries
 * primitive fields = the correct wire shape.
 *
 * Unknown domain events are dropped (defensive — the wiring only
 * subscribes the 9 known classes, so this is unreachable in practice).
 */
export class ClusterEventPublisher {
  constructor(private readonly sink: ClusterEventSink) {}

  async publish(event: DomainEvent): Promise<void> {
    const wire = this.bind(event);
    if (wire === null) return;
    await this.sink.emit(wire.clusterId, wire);
  }

  private bind(event: DomainEvent): ClusterEvent | null {
    if (event instanceof NodePlanStarted) {
      return new NodePlanStartedV1(...this.fields(event));
    }
    if (event instanceof NodePlanSucceeded) {
      return new NodePlanSucceededV1(...this.fields(event));
    }
    if (event instanceof NodePlanFailed) {
      return new NodePlanFailedV1(...this.fields(event));
    }
    if (event instanceof NodeApplyStarted) {
      return new NodeApplyStartedV1(...this.fields(event));
    }
    if (event instanceof NodeApplySucceeded) {
      return new NodeApplySucceededV1(...this.fields(event));
    }
    if (event instanceof NodeApplyFailed) {
      return new NodeApplyFailedV1(...this.fields(event));
    }
    if (event instanceof NodeDestroyStarted) {
      return new NodeDestroyStartedV1(...this.fields(event));
    }
    if (event instanceof NodeDestroySucceeded) {
      return new NodeDestroySucceededV1(...this.fields(event));
    }
    if (event instanceof NodeDestroyFailed) {
      return new NodeDestroyFailedV1(...this.fields(event));
    }
    return null;
  }

  /** Common 4-tuple every cluster node event maps to (eventId, occurredAt, clusterId, nodeId). */
  private fields(
    event: { eventId: { value: string }; occurredAt: { toString(): string } } & {
      clusterId: { value: string };
      nodeId: { value: string };
    },
  ): [string, string, string, string] {
    return [
      event.eventId.value,
      event.occurredAt.toString(),
      event.clusterId.value,
      event.nodeId.value,
    ];
  }
}
