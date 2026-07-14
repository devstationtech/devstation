import { assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Aggregate } from "@server/shared/building-blocks/domain/models/aggregate.ts";
import { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { EventBag } from "@server/shared/building-blocks/domain/events/event-bag.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";

/**
 * Aggregate is the base every BC root extends. Three guarantees we
 * pin here: version starts at 1, bump() increments it once per
 * mutation, and the events bag is initially empty / drained by
 * pull().
 */

class Sample extends Aggregate {
  readonly id = "sample-1";

  constructor(creation?: Creation, version?: Version) {
    super(
      creation ??
        new Creation(
          new User("alice"),
          new Hostname("workstation"),
          Instant.fromString("2026-01-01T00:00:00.000Z"),
        ),
      version,
    );
  }

  /** Public hook so tests can drive bump() without inventing fake methods. */
  mutate(event?: DomainEvent): void {
    if (event) this.events.push(event);
    this.bump();
  }
}

describe("Aggregate — defaults", () => {
  it("defaults version to 1 when no version is provided", () => {
    /* @When the aggregate is constructed without a version arg */
    const a = new Sample();
    /* @Then version is 1 (the start-of-life value) */
    assertEquals(a.version.value, 1);
  });

  it("starts with an empty events bag", () => {
    const a = new Sample();
    assertEquals(a.events instanceof EventBag, true);
    assertEquals(a.events.size, 0);
  });

  it("preserves the provided creation metadata verbatim", () => {
    const creation = new Creation(
      new User("bob"),
      new Hostname("laptop"),
      Instant.fromString("2025-12-31T12:00:00.000Z"),
    );
    const a = new Sample(creation);
    assertEquals(a.creation, creation);
  });

  it("preserves a non-default version when explicitly given (rehydration scenario)", () => {
    /* @Given a saved-state load with version=42 */
    const a = new Sample(undefined, new Version(42));
    /* @Then the loaded version is preserved (not reset to 1) */
    assertEquals(a.version.value, 42);
  });
});

describe("Aggregate.bump", () => {
  it("increments version by 1 each call (mutation marker)", () => {
    const a = new Sample();
    a.mutate();
    assertEquals(a.version.value, 2);
    a.mutate();
    assertEquals(a.version.value, 3);
  });

  it("produces a new Version instance (immutability — old refs do NOT mutate)", () => {
    /* @Given we capture a reference to the initial Version */
    const a = new Sample();
    const v0 = a.version;
    /* @When bump runs */
    a.mutate();
    /* @Then the original Version object is unchanged; aggregate now points to a new one */
    assertEquals(v0.value, 1);
    assertNotEquals(a.version, v0);
    assertEquals(a.version.value, 2);
  });
});

describe("Aggregate.events", () => {
  // A tiny in-test DomainEvent — we only need the shape, not a real event class.
  const aDomainEvent = (): DomainEvent => ({} as DomainEvent);

  it("queues events the subclass pushed and drains them via pull()", () => {
    const a = new Sample();
    /* @When two events are pushed */
    a.mutate(aDomainEvent());
    a.mutate(aDomainEvent());
    assertEquals(a.events.size, 2);
    /* @When pull is called */
    const drained = a.events.pull();
    /* @Then the events are returned in push order and the bag is empty */
    assertEquals(drained.length, 2);
    assertEquals(a.events.size, 0);
  });

  it("pull twice returns the first batch and then an empty batch (no double dispatch)", () => {
    const a = new Sample();
    a.mutate(aDomainEvent());
    const first = a.events.pull();
    const second = a.events.pull();
    assertEquals(first.length, 1);
    assertEquals(second.length, 0);
  });
});
