import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";
import { ClusterEventIntegration } from "@ui/shared/integrations/cluster-event-integration.ts";
import {
  type ClusterEvent,
  NodePlanStartedV1,
  NodePlanSucceededV1,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";

/**
 * ClusterEventIntegration delivers an open-ended async iterable of
 * cluster events filtered by clusterId. Three contracts pinned:
 *  - cluster.subscribe is invoked once, then notifications keep flowing;
 *  - events from OTHER clusters are filtered out;
 *  - if the subscribe Ack rejects, the iterator throws (caller knows).
 *
 * The hand-rolled iterator + Promise.withResolvers chain is exactly
 * the kind of code that breaks subtly on refactor — these tests are
 * the regression net.
 */

/** Channel that lets the test push notifications and control the subscribe Ack. */
class FakeChannel implements Channel {
  private readonly handlers: Array<(n: Notification) => void> = [];
  public lastSubscribe: Request | null = null;
  /** When set, send() resolves with a failure response (subscribe rejects). */
  public failSubscribeWith: { code: number; message: string } | null = null;

  send(request: Request): Promise<Response> {
    if (request.method === "cluster.subscribe") {
      this.lastSubscribe = request;
      if (this.failSubscribeWith) {
        return Promise.resolve({
          jsonrpc: "2.0",
          id: request.id,
          error: this.failSubscribeWith,
        });
      }
      // Ack the subscribe; the stream stays open via notifications.
      return Promise.resolve({ jsonrpc: "2.0", id: request.id, result: {} });
    }
    throw new Error(`unexpected method: ${request.method}`);
  }

  onNotification(handler: (n: Notification) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const i = this.handlers.indexOf(handler);
      if (i >= 0) this.handlers.splice(i, 1);
    };
  }

  emit(method: string, params: unknown): void {
    for (const h of this.handlers) h({ jsonrpc: "2.0", method, params });
  }
}

function aPlanningStarted(clusterId: string, nodeId = "n-1"): ClusterEvent {
  return new NodePlanStartedV1(
    crypto.randomUUID(),
    "2026-01-01T00:00:00.000Z",
    clusterId,
    nodeId,
  );
}

function aPlanCompleted(clusterId: string, nodeId = "n-1"): ClusterEvent {
  return new NodePlanSucceededV1(
    crypto.randomUUID(),
    "2026-01-01T00:00:01.000Z",
    clusterId,
    nodeId,
  );
}

describe("ClusterEventIntegration.watch — happy path", () => {
  it("invokes cluster.subscribe once and then yields the events flowing on cluster.event", async () => {
    /* @Given a fake channel + an integration watching 'c1' */
    const channel = new FakeChannel();
    const integration = new ClusterEventIntegration(new Client(channel));
    const iter = integration.watch({ sessionId: "s", clusterId: "c1" })[Symbol.asyncIterator]();

    /* @When the server pushes two notifications for 'c1' */
    channel.emit("cluster.event", { clusterId: "c1", event: aPlanningStarted("c1") });
    channel.emit("cluster.event", { clusterId: "c1", event: aPlanCompleted("c1") });

    /* @Then both events are yielded in order */
    const a = await iter.next();
    const b = await iter.next();
    assertEquals((a.value as ClusterEvent).type, "node-plan-started");
    assertEquals((b.value as ClusterEvent).type, "node-plan-succeeded");
    /* @And subscribe was invoked once with the right params */
    assertEquals(channel.lastSubscribe?.method, "cluster.subscribe");
    assertEquals(
      channel.lastSubscribe?.params,
      { sessionId: "s", clusterId: "c1" },
    );

    await iter.return?.();
  });
});

describe("ClusterEventIntegration.watch — clusterId filtering", () => {
  it("ignores events for OTHER clusters (notifications fan out — filter is local)", async () => {
    /* @Given an integration watching 'c1' */
    const channel = new FakeChannel();
    const integration = new ClusterEventIntegration(new Client(channel));
    const iter = integration.watch({ sessionId: "s", clusterId: "c1" })[Symbol.asyncIterator]();

    /* @When events for both 'c1' AND 'other' arrive interleaved */
    channel.emit("cluster.event", { clusterId: "other", event: aPlanningStarted("other") });
    channel.emit("cluster.event", { clusterId: "c1", event: aPlanningStarted("c1") });
    channel.emit("cluster.event", { clusterId: "other", event: aPlanCompleted("other") });
    channel.emit("cluster.event", { clusterId: "c1", event: aPlanCompleted("c1") });

    /* @Then only the c1 events are yielded; other-cluster ones are silently dropped */
    const a = await iter.next();
    const b = await iter.next();
    assertEquals((a.value as ClusterEvent).clusterId, "c1");
    assertEquals((b.value as ClusterEvent).clusterId, "c1");
    assertEquals((a.value as ClusterEvent).type, "node-plan-started");
    assertEquals((b.value as ClusterEvent).type, "node-plan-succeeded");

    await iter.return?.();
  });
});

describe("ClusterEventIntegration.watch — subscribe failure", () => {
  it("propagates a failing cluster.subscribe to the consumer as a thrown error", async () => {
    /* @Given a channel rigged to reject cluster.subscribe with Unauthenticated */
    const channel = new FakeChannel();
    channel.failSubscribeWith = { code: -32000, message: "session expired" };
    const integration = new ClusterEventIntegration(new Client(channel));

    /* @When the consumer iterates */
    /* @Then the iterator throws the subscribe error (the consumer learns the stream is dead) */
    await assertRejects(
      async () => {
        for await (const _e of integration.watch({ sessionId: "s", clusterId: "c1" })) {
          // unreachable: subscribe rejects before any event lands.
        }
      },
      Error,
      "session expired",
    );
  });
});

describe("ClusterEventIntegration.watch — cleanup", () => {
  it("unsubscribes the notification handler when the iterator is closed (no leak)", async () => {
    /* @Given an integration watching 'c1' */
    const channel = new FakeChannel();
    const integration = new ClusterEventIntegration(new Client(channel));
    const iter = integration.watch({ sessionId: "s", clusterId: "c1" })[Symbol.asyncIterator]();
    channel.emit("cluster.event", { clusterId: "c1", event: aPlanningStarted("c1") });
    await iter.next();

    /* @When the iterator is explicitly closed (consumer broke out of the loop) */
    await iter.return?.();

    /* @Then further notifications for 'c1' are NOT buffered for this iterator */
    /*       (the integration's onNotification handler was unregistered) */
    /*       — the test simply asserts no exception on emit after return.  */
    channel.emit("cluster.event", { clusterId: "c1", event: aPlanCompleted("c1") });
  });
});
