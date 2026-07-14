import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";
import { InProcessBus } from "@server/shared/building-blocks/outbound/events/in-process-bus.ts";
import { Adapter as ClusterDispatcherAdapter } from "@server/cluster/outbound/dispatcher-adapter.ts";
import { InMemoryClusterEventSink } from "@server/cluster/inbound/rpc/in-memory-cluster-event-sink.ts";
import { ClusterEventPublisher } from "@server/cluster/inbound/rpc/event-publisher.ts";
import { SubscribeClusterEndpoint } from "@server/cluster/inbound/rpc/subscribe/endpoint.ts";
import { Id as ClusterId } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { NodePlanSucceeded } from "@server/cluster/domain/events/node-plan-succeeded.ts";
import { NodeDestroySucceeded } from "@server/cluster/domain/events/node-destroy-succeeded.ts";

const silentLogger: Logger = {
  info: async () => {},
  warn: async () => {},
  error: async () => {},
};

const SESSION = { sessionId: "s", key: "k", expiresAt: new Date() };
const CID = "11111111-1111-1111-1111-111111111111";
const NID = "22222222-2222-2222-2222-222222222222";

class CapturingCtx implements DispatchContext {
  readonly sent: { method: string; params: unknown }[] = [];
  notify<P>(method: string, params: P): Promise<void> {
    this.sent.push({ method, params });
    return Promise.resolve();
  }
}

/**
 * Mirrors the P3 wiring from dependencies.ts with real pieces: one sink
 * shared by the publisher and the endpoint, the publisher subscribed to
 * cluster domain events on the dispatcher's topic. Validates the
 * end-to-end chain: dispatcher publishes domain event on `clusters.v1`
 * → bus routes to publisher → bind domain→*V1 → sink fan-out →
 * subscribed ctx gets a `cluster.event` notification.
 */
function wire() {
  const bus = new InProcessBus(silentLogger);
  const sink = new InMemoryClusterEventSink();
  const publisher = new ClusterEventPublisher(sink);
  bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodePlanSucceeded, {
    on: (e) => publisher.publish(e),
  });
  bus.subscribe(ClusterDispatcherAdapter.TOPIC, NodeDestroySucceeded, {
    on: (e) => publisher.publish(e),
  });
  const dispatcher = new ClusterDispatcherAdapter(bus);
  const endpoint = new SubscribeClusterEndpoint(sink);
  return { dispatcher, endpoint };
}

describe("cluster.subscribe wiring (P3) — dispatcher→bus→publisher→sink→ctx", () => {
  it("delivers a bound *V1 cluster.event to a subscribed client", async () => {
    /* @Given the full dispatcher→bus→publisher→sink chain with a subscribed ctx */
    const { dispatcher, endpoint } = wire();
    const ctx = new CapturingCtx();
    endpoint.dispatch({ sessionId: "s", clusterId: CID }, SESSION, ctx);

    /* @When a domain event is dispatched on the bus topic */
    await dispatcher.dispatch([
      new NodePlanSucceeded(new ClusterId(CID), new NodeId(NID)),
    ]);

    /* @Then the ctx receives a bound *V1 cluster.event */
    assertEquals(ctx.sent.length, 1);
    assertEquals(ctx.sent[0].method, "cluster.event");
    const wireParams = JSON.parse(JSON.stringify(ctx.sent[0].params)) as {
      clusterId: string;
      event: { type: string; clusterId: string; nodeId: string };
    };
    assertEquals(wireParams.clusterId, CID);
    assertEquals(wireParams.event.type, "node-plan-succeeded");
    assertEquals(wireParams.event.clusterId, CID);
    assertEquals(wireParams.event.nodeId, NID);
  });

  it("routes only events of the subscribed cluster", async () => {
    /* @Given a ctx subscribed to one cluster through the full chain */
    const { dispatcher, endpoint } = wire();
    const ctx = new CapturingCtx();
    endpoint.dispatch({ sessionId: "s", clusterId: CID }, SESSION, ctx);

    /* @When a domain event for a different cluster is dispatched */
    await dispatcher.dispatch([
      new NodeDestroySucceeded(
        new ClusterId("99999999-9999-9999-9999-999999999999"),
        new NodeId(NID),
      ),
    ]);

    /* @Then nothing is delivered */
    assertEquals(ctx.sent.length, 0);
  });
});
