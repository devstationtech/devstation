import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { InProcessBus } from "@server/shared/building-blocks/outbound/events/in-process-bus.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import type { Policy } from "@server/shared/building-blocks/domain/ports/events/outbound/policy.ts";
import { EventId } from "@server/shared/building-blocks/domain/events/event-id.ts";
import { Topic } from "@server/shared/building-blocks/domain/events/topic.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";

const TOPIC = new Topic("fakes.v1");

class SomethingHappened implements DomainEvent {
  readonly eventId = new EventId();
  readonly occurredAt = new Instant();
  constructor(readonly payload: string) {}
}

class SomethingElseHappened implements DomainEvent {
  readonly eventId = new EventId();
  readonly occurredAt = new Instant();
}

class RecordingPolicy implements Policy<SomethingHappened> {
  readonly received: SomethingHappened[] = [];
  on(event: SomethingHappened): Promise<void> {
    this.received.push(event);
    return Promise.resolve();
  }
}

class FailingPolicy implements Policy<SomethingHappened> {
  on(_event: SomethingHappened): Promise<void> {
    return Promise.reject(new Error("policy failed"));
  }
}

type LogEntry = { level: "info" | "warn" | "error"; origin: string; message: string };

class FakeLogger implements Logger {
  readonly entries: LogEntry[] = [];
  info(origin: string, message: string): Promise<void> {
    this.entries.push({ level: "info", origin, message });
    return Promise.resolve();
  }
  warn(origin: string, message: string): Promise<void> {
    this.entries.push({ level: "warn", origin, message });
    return Promise.resolve();
  }
  error(origin: string, message: string): Promise<void> {
    this.entries.push({ level: "error", origin, message });
    return Promise.resolve();
  }
}

describe("InProcessBus", () => {
  let logger: FakeLogger;
  let calls: string[];
  let bus: InProcessBus;

  beforeEach(() => {
    logger = new FakeLogger();
    calls = [];
    bus = new InProcessBus(logger);
  });

  afterEach(() => {/* nothing */});

  it("publishes an event to a subscribed policy under the same topic and class", async () => {
    /* @Given a policy subscribed to SomethingHappened under topic fakes.v1 */
    const policy = new RecordingPolicy();
    bus.subscribe(TOPIC, SomethingHappened, policy);

    /* @When the bus publishes a SomethingHappened under the same topic */
    await bus.publish(TOPIC, new SomethingHappened("hello"));

    /* @Then the policy receives the event */
    assertEquals(policy.received.length, 1);
    assertEquals(policy.received[0].payload, "hello");
  });

  it("publishes to multiple policies in subscription order", async () => {
    /* @Given two policies subscribed to the same event under the same topic */
    class OrderedPolicy implements Policy<SomethingHappened> {
      constructor(readonly tag: string) {}
      on(_event: SomethingHappened): Promise<void> {
        calls.push(this.tag);
        return Promise.resolve();
      }
    }
    bus.subscribe(TOPIC, SomethingHappened, new OrderedPolicy("a"));
    bus.subscribe(TOPIC, SomethingHappened, new OrderedPolicy("b"));

    /* @When the bus publishes */
    await bus.publish(TOPIC, new SomethingHappened("x"));

    /* @Then both are called in subscription order */
    assertEquals(calls, ["a", "b"]);
  });

  it("ignores policies subscribed to a different event class within the same topic", async () => {
    /* @Given a policy subscribed to SomethingHappened */
    const policy = new RecordingPolicy();
    bus.subscribe(TOPIC, SomethingHappened, policy);

    /* @When publishing SomethingElseHappened under the same topic */
    await bus.publish(TOPIC, new SomethingElseHappened());

    /* @Then the policy receives nothing */
    assertEquals(policy.received.length, 0);
  });

  it("ignores policies subscribed to a different topic", async () => {
    /* @Given a policy subscribed under topic foo.v1 */
    const policy = new RecordingPolicy();
    bus.subscribe(new Topic("foo.v1"), SomethingHappened, policy);

    /* @When publishing under topic bar.v1 */
    await bus.publish(new Topic("bar.v1"), new SomethingHappened("crosstopic"));

    /* @Then the policy receives nothing */
    assertEquals(policy.received.length, 0);
  });

  it("does not fail when no subscriber exists for the event", async () => {
    /* @Given a bus without subscriptions */
    /* @When publishing any event */
    await bus.publish(TOPIC, new SomethingHappened("orphan"));

    /* @Then the publish log is recorded and nothing fails */
    assert(logger.entries.some((e) => e.message.includes("0 subscriber(s)")));
  });

  it("propagates errors thrown by a policy", async () => {
    /* @Given a policy that fails */
    bus.subscribe(TOPIC, SomethingHappened, new FailingPolicy());

    /* @When publishing */
    /* @Then the error propagates */
    await assertRejects(
      () => bus.publish(TOPIC, new SomethingHappened("boom")),
      Error,
      "policy failed",
    );
  });

  it("stops dispatching to remaining policies when one fails", async () => {
    /* @Given a failing policy followed by a recording policy */
    const recording = new RecordingPolicy();
    bus.subscribe(TOPIC, SomethingHappened, new FailingPolicy());
    bus.subscribe(TOPIC, SomethingHappened, recording);

    /* @When publishing */
    /* @Then the error propagates and the second policy is not called */
    await assertRejects(() => bus.publish(TOPIC, new SomethingHappened("boom")), Error);
    assertEquals(recording.received.length, 0);
  });

  it("logs publish start, each policy hit, and policy failure", async () => {
    /* @Given a bus with one ok policy and one that fails */
    bus.subscribe(TOPIC, SomethingHappened, new RecordingPolicy());
    bus.subscribe(TOPIC, SomethingHappened, new FailingPolicy());

    /* @When publishing and the second one fails */
    await assertRejects(() => bus.publish(TOPIC, new SomethingHappened("trace")), Error);

    /* @Then the log records publish + handled for the first + failed for the second */
    const messages = logger.entries.map((e) => `${e.level}:${e.message}`);
    assert(messages.some((m) => m.startsWith("info:publish fakes.v1::SomethingHappened")));
    assert(messages.some((m) => m.includes("RecordingPolicy handled SomethingHappened")));
    assert(messages.some((m) => m.startsWith("error:") && m.includes("FailingPolicy failed")));
  });
});

describe("Topic VO", () => {
  it("accepts a valid aggregate.v<n> identifier", () => {
    /* @Given a valid identifier */
    /* @When the Topic is built */
    /* @Then no exception is thrown */
    new Topic("stations.v1");
    new Topic("cluster-nodes.v12");
  });

  it("rejects a malformed identifier", () => {
    /* @Given strings that do not match aggregate.v<n> */
    /* @When the Topic is built */
    /* @Then it throws */
    assertThrows(() => new Topic("nope"), Error, "Invalid topic");
    assertThrows(() => new Topic("stations"), Error, "Invalid topic");
    assertThrows(() => new Topic("stations.v0"), Error, "Invalid topic");
    assertThrows(() => new Topic("Stations.v1"), Error, "Invalid topic");
    assertThrows(() => new Topic(""), Error, "Invalid topic");
  });
});
