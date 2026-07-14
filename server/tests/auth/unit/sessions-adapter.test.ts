import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";
import { SessionsAdapter } from "@server/auth/outbound/sessions-adapter.ts";
import { Session } from "@server/auth/domain/models/session.ts";
import { Key } from "@server/auth/domain/models/key.ts";
import { Unauthenticated } from "@server/shared/authentication/domain/exceptions/unauthenticated.ts";

/**
 * SessionsAdapter is the in-process session store consumed by the
 * RPC auth boundary. Pins four contracts:
 *  - save persists the session and tags it as "active";
 *  - get(id) returns the session OR throws Unauthenticated;
 *  - expiration: get of an expired session deletes the entry AND
 *    throws Unauthenticated (cleanup on read — no stale entries);
 *  - active() returns the most-recently-saved session, Unauthenticated
 *    if none was ever saved.
 *
 * Time-sensitive expiration is driven with @std/testing FakeTime so
 * tests don't depend on real clock advancement.
 */

const aKey = (): Key => new Key("deadbeef".repeat(8));

describe("SessionsAdapter.save / get", () => {
  it("round-trips a session: save → get(id) returns an equivalent Session", () => {
    /* @Given a fresh adapter and an opened Session */
    const adapter = new SessionsAdapter();
    const session = Session.open(aKey());
    /* @When saved and fetched by id */
    adapter.save(session);
    const got = adapter.get(session.id.value);
    /* @Then the returned session has the same id + key (expiration also round-trips) */
    assertEquals(got.id.value, session.id.value);
    assertEquals(got.key.value, session.key.value);
  });

  it("throws Unauthenticated when get is called with an unknown id", () => {
    /* @Given an empty adapter */
    const adapter = new SessionsAdapter();
    /* @When get with an unregistered id */
    /* @Then Unauthenticated is raised — never returns null or undefined */
    assertThrows(
      () => adapter.get("00000000-0000-0000-0000-000000000099"),
      Unauthenticated,
    );
  });
});

describe("SessionsAdapter — expiration", () => {
  it("deletes the entry AND throws Unauthenticated when the session has expired", () => {
    /* @Given an adapter with a saved session at time T0 */
    const fakeTime = new FakeTime(new Date("2026-01-01T00:00:00.000Z"));
    try {
      const adapter = new SessionsAdapter();
      const session = Session.open(aKey());
      adapter.save(session);

      /* @When the clock advances past the TTL (10 min default) */
      fakeTime.tick(11 * 60 * 1000);

      /* @Then get raises Unauthenticated */
      assertThrows(() => adapter.get(session.id.value), Unauthenticated);
      /* @And a subsequent attempt also fails — the entry was cleaned up on read */
      assertThrows(() => adapter.get(session.id.value), Unauthenticated);
    } finally {
      fakeTime.restore();
    }
  });

  it("returns the session if the clock is still within the TTL window", () => {
    /* @Given an adapter with a saved session */
    const fakeTime = new FakeTime(new Date("2026-01-01T00:00:00.000Z"));
    try {
      const adapter = new SessionsAdapter();
      const session = Session.open(aKey());
      adapter.save(session);
      /* @When the clock advances ONLY 1 minute (well within the 10-min TTL) */
      fakeTime.tick(60 * 1000);
      /* @Then get still succeeds */
      assertEquals(adapter.get(session.id.value).id.value, session.id.value);
    } finally {
      fakeTime.restore();
    }
  });
});

describe("SessionsAdapter.active", () => {
  it("throws Unauthenticated when no session has been saved yet", () => {
    /* @Given a fresh adapter */
    const adapter = new SessionsAdapter();
    /* @When active() is called */
    /* @Then Unauthenticated is raised */
    assertThrows(() => adapter.active(), Unauthenticated);
  });

  it("returns the most-recently-saved session (overwrites the active pointer)", () => {
    /* @Given two sessions saved in sequence */
    const adapter = new SessionsAdapter();
    const first = Session.open(aKey());
    const second = Session.open(new Key("cafebabe".repeat(8)));
    adapter.save(first);
    adapter.save(second);
    /* @When active() is called */
    /* @Then it returns the second session (active pointer follows last save) */
    assertEquals(adapter.active().id.value, second.id.value);
  });
});
