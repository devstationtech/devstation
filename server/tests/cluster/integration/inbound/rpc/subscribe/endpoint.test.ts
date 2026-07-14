import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";
import { NodePlanSucceededV1 } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { InMemoryClusterEventSink } from "@server/cluster/inbound/rpc/in-memory-cluster-event-sink.ts";
import { SubscribeClusterEndpoint } from "@server/cluster/inbound/rpc/subscribe/endpoint.ts";

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

function v1(): NodePlanSucceededV1 {
  return new NodePlanSucceededV1("e1", "2026-01-01T00:00:00.000Z", CID, NID);
}

describe("cluster.subscribe endpoint + InMemoryClusterEventSink — integration", () => {
  it("registers the ctx and routes cluster.event notifications for that cluster", async () => {
    /* @Given a sink + endpoint with a subscribed ctx */
    const sink = new InMemoryClusterEventSink();
    const endpoint = new SubscribeClusterEndpoint(sink);
    const ctx = new CapturingCtx();

    /* @When the client subscribes to the cluster */
    const ack = endpoint.dispatch({ sessionId: "s", clusterId: CID }, SESSION, ctx);
    assertEquals(ack, {});

    /* @And an event is emitted for that cluster */
    await sink.emit(CID, v1());

    /* @Then the ctx receives a cluster.event with the wire-shaped payload */
    assertEquals(ctx.sent.length, 1);
    assertEquals(ctx.sent[0].method, "cluster.event");
    // Transport JSON-serializes at the stdio boundary; assert the wire
    // shape rather than class-instance identity.
    assertEquals(JSON.parse(JSON.stringify(ctx.sent[0].params)), {
      clusterId: CID,
      event: {
        type: "node-plan-succeeded",
        eventId: "e1",
        occurredAt: "2026-01-01T00:00:00.000Z",
        clusterId: CID,
        nodeId: NID,
      },
    });
  });

  it("does not deliver events of a different cluster", async () => {
    /* @Given a ctx subscribed to one cluster */
    const sink = new InMemoryClusterEventSink();
    const endpoint = new SubscribeClusterEndpoint(sink);
    const ctx = new CapturingCtx();

    /* @When an event is emitted for a different cluster */
    endpoint.dispatch({ sessionId: "s", clusterId: CID }, SESSION, ctx);
    await sink.emit("99999999-9999-9999-9999-999999999999", v1());

    /* @Then nothing is delivered */
    assertEquals(ctx.sent.length, 0);
  });

  it("emit is a no-op when no one is subscribed", async () => {
    /* @Given a sink with no subscribers */
    const sink = new InMemoryClusterEventSink();
    /* @When an event is emitted */
    /* @Then it completes without throwing */
    await sink.emit(CID, v1());
    // no throw, nothing to assert beyond completion
  });

  it("unregister thunk stops further delivery", async () => {
    /* @Given a registered ctx that received one event */
    const sink = new InMemoryClusterEventSink();
    const ctx = new CapturingCtx();
    const off = sink.register(CID, ctx);

    /* @When the unregister thunk runs and another event is emitted */
    await sink.emit(CID, v1());
    off();
    await sink.emit(CID, v1());

    /* @Then the post-unregister event is not delivered */
    assertEquals(ctx.sent.length, 1);
  });

  it("fans out to multiple ctx on the same cluster", async () => {
    /* @Given two ctx registered on the same cluster */
    const sink = new InMemoryClusterEventSink();
    const a = new CapturingCtx();
    const b = new CapturingCtx();
    sink.register(CID, a);
    sink.register(CID, b);

    /* @When an event is emitted */
    await sink.emit(CID, v1());

    /* @Then both ctx receive it */
    assertEquals(a.sent.length, 1);
    assertEquals(b.sent.length, 1);
  });

  it("missing ctx (no notifications wired) registers nothing and still acks", () => {
    /* @Given a subscribe with no dispatch ctx */
    const sink = new InMemoryClusterEventSink();
    const endpoint = new SubscribeClusterEndpoint(sink);
    /* @When the client subscribes */
    const ack = endpoint.dispatch({ sessionId: "s", clusterId: CID }, SESSION, undefined);
    /* @Then it still acks (registering nothing) */
    assertEquals(ack, {});
  });
});
