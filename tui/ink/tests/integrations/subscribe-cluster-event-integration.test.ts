import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Client } from "@jsonrpc-client-ts/client.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";
import { ClusterEventIntegration } from "@ui/shared/integrations/cluster-event-integration.ts";
import {
  ClusterEventNotification,
  NodePlanStartedV1,
  NodePlanSucceededV1,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";

const CID = "11111111-1111-1111-1111-111111111111";
const NID = "22222222-2222-2222-2222-222222222222";

/**
 * Fake channel: `send` Acks any request immediately (mirrors
 * cluster.subscribe register-and-return); `push` lets the test deliver
 * server-initiated `cluster.event` notifications, JSON round-tripped to
 * mirror the real stdio transport (UI sees plain objects).
 */
class FakeChannel implements Channel {
  private handler: ((n: Notification) => void) | null = null;

  send(request: Request): Promise<Response> {
    return Promise.resolve({ jsonrpc: "2.0", id: request.id, result: {} });
  }

  onNotification(handler: (n: Notification) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  push(method: string, params: unknown): void {
    const wire = JSON.parse(JSON.stringify({ jsonrpc: "2.0", method, params }));
    this.handler?.(wire);
  }
}

describe("ClusterEventIntegration — UI consumes cluster.event stream", () => {
  it("yields cluster.event params filtered by clusterId; ends + unsubscribes on break", async () => {
    /* @Given a watch subscribed to one clusterId */
    const channel = new FakeChannel();
    const integration = new ClusterEventIntegration(new Client(channel));

    const stream = integration.watch({ sessionId: "s", clusterId: CID });
    const it = stream[Symbol.asyncIterator]();

    /* @When events for that cluster (and one for another) are pushed */
    // Event for another cluster is filtered out.
    channel.push(
      "cluster.event",
      new ClusterEventNotification(
        "99999999-9999-9999-9999-999999999999",
        new NodePlanStartedV1("e0", "t0", "other", NID),
      ),
    );
    // Two events for the subscribed cluster.
    channel.push(
      "cluster.event",
      new ClusterEventNotification(CID, new NodePlanStartedV1("e1", "t1", CID, NID)),
    );
    channel.push(
      "cluster.event",
      new ClusterEventNotification(CID, new NodePlanSucceededV1("e2", "t2", CID, NID)),
    );

    /* @Then only the subscribed cluster's events are yielded, in order */
    const first = await it.next();
    assertEquals(first.done, false);
    assertEquals(first.value.type, "node-plan-started");
    assertEquals((first.value as NodePlanStartedV1).eventId, "e1");

    const second = await it.next();
    assertEquals(second.value.type, "node-plan-succeeded");
    assertEquals(second.value.clusterId, CID);

    /* @And on break the generator finally unsubscribes; later pushes are ignored */
    // Consumer stops: generator finally must unsubscribe.
    const ret = await it.return?.(undefined);
    assertEquals(ret?.done, true);
    // After unsubscribe, pushing more does not throw / is ignored.
    channel.push(
      "cluster.event",
      new ClusterEventNotification(CID, new NodePlanSucceededV1("e3", "t3", CID, NID)),
    );
  });

  it("surfaces a failed cluster.subscribe as a thrown error", async () => {
    class FailingChannel implements Channel {
      send(request: Request): Promise<Response> {
        return Promise.resolve({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32000, message: "Unauthenticated." },
        });
      }
      onNotification(): () => void {
        return () => {};
      }
    }
    /* @Given a channel that fails the cluster.subscribe request */
    const integration = new ClusterEventIntegration(new Client(new FailingChannel()));
    const stream = integration.watch({ sessionId: "s", clusterId: CID });

    /* @When the stream is consumed */
    let threw = false;
    try {
      for await (const _ of stream) { /* should not yield */ }
    } catch (_e) {
      threw = true;
    }
    /* @Then the failure surfaces as a thrown error */
    assertEquals(threw, true);
  });
});
