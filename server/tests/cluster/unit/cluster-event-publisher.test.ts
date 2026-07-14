import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { ClusterEvent } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { ClusterEventPublisher } from "@server/cluster/inbound/rpc/event-publisher.ts";
import type { ClusterEventSink } from "@server/cluster/inbound/rpc/cluster-event-sink.ts";
import { Id as ClusterId } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { NodePlanStarted } from "@server/cluster/domain/events/node-plan-started.ts";
import { NodePlanSucceeded } from "@server/cluster/domain/events/node-plan-succeeded.ts";
import { NodeApplySucceeded } from "@server/cluster/domain/events/node-apply-succeeded.ts";
import { NodeDestroySucceeded } from "@server/cluster/domain/events/node-destroy-succeeded.ts";
import { NodeDestroyFailed } from "@server/cluster/domain/events/node-destroy-failed.ts";

class CapturingSink implements ClusterEventSink {
  readonly emitted: { clusterId: string; event: ClusterEvent }[] = [];
  emit(clusterId: string, event: ClusterEvent): Promise<void> {
    this.emitted.push({ clusterId, event });
    return Promise.resolve();
  }
}

const CID = "11111111-1111-1111-1111-111111111111";
const NID = "22222222-2222-2222-2222-222222222222";

describe("ClusterEventPublisher", () => {
  it("binds each domain event to its versioned *V1 wire class and emits via the sink", async () => {
    /* @Given a publisher wired to a capturing sink */
    const sink = new CapturingSink();
    const publisher = new ClusterEventPublisher(sink);

    /* @When a NodePlanStarted domain event is published */
    const started = new NodePlanStarted(new ClusterId(CID), new NodeId(NID));
    await publisher.publish(started);

    /* @Then the sink receives one wire event carrying the same identity + fields */
    assertEquals(sink.emitted.length, 1);
    const { clusterId, event } = sink.emitted[0];
    assertEquals(clusterId, CID);
    assertEquals(event.type, "node-plan-started");
    assertEquals(event.clusterId, CID);
    assertEquals(event.nodeId, NID);
    assertEquals(event.eventId, started.eventId.value);
    assertEquals(event.occurredAt, started.occurredAt.toString());
  });

  it("maps the discriminator for every variant", async () => {
    /* @Given a publisher and the four lifecycle outcome events */
    const sink = new CapturingSink();
    const publisher = new ClusterEventPublisher(sink);
    const cid = new ClusterId(CID);
    const nid = new NodeId(NID);

    /* @When each variant is published */
    await publisher.publish(new NodePlanSucceeded(cid, nid));
    await publisher.publish(new NodeApplySucceeded(cid, nid));
    await publisher.publish(new NodeDestroySucceeded(cid, nid));
    await publisher.publish(new NodeDestroyFailed(cid, nid));

    /* @Then each emits its own wire discriminator in order */
    assertEquals(
      sink.emitted.map((e) => e.event.type),
      [
        "node-plan-succeeded",
        "node-apply-succeeded",
        "node-destroy-succeeded",
        "node-destroy-failed",
      ],
    );
  });

  it("drops unknown domain events (no emit)", async () => {
    /* @Given a publisher and an event with no registered wire binding */
    const sink = new CapturingSink();
    const publisher = new ClusterEventPublisher(sink);

    /* @When the unknown event is published */
    await publisher.publish(
      {
        eventId: { value: "x" },
        occurredAt: { toString: () => "t" },
      } as unknown as Parameters<ClusterEventPublisher["publish"]>[0],
    );

    /* @Then nothing is emitted */
    assertEquals(sink.emitted.length, 0);
  });

  it("serializes to the exact wire JSON shape (no VO leakage)", async () => {
    /* @Given a published NodePlanSucceeded event */
    const sink = new CapturingSink();
    const publisher = new ClusterEventPublisher(sink);
    const ev = new NodePlanSucceeded(new ClusterId(CID), new NodeId(NID));

    await publisher.publish(ev);

    /* @When the emitted event is round-tripped through JSON */
    const json = JSON.parse(JSON.stringify(sink.emitted[0].event));
    /* @Then it is a flat wire shape with no value-object leakage */
    assertEquals(json, {
      type: "node-plan-succeeded",
      eventId: ev.eventId.value,
      occurredAt: ev.occurredAt.toString(),
      clusterId: CID,
      nodeId: NID,
    });
  });
});
