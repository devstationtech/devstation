import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Session } from "@server/auth/domain/models/session.ts";
import { Id } from "@server/auth/domain/models/id.ts";
import { Key } from "@server/auth/domain/models/key.ts";
import { Expiration } from "@server/auth/domain/models/expiration.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { authKey } from "@tests/auth/fixtures/operations.ts";

describe("Session.open", () => {
  it("should open a new session from a key", () => {
    /* @Given a valid session key */
    const key = authKey();

    /* @When the session is opened */
    const session = Session.open(key);

    /* @Then the session should contain a unique id and the key */
    assert(session.id.value.length > 0);
    assertEquals(session.key.value, "test-key");
    assertEquals(session.isExpired(), false);
  });

  it("should generate a unique id on each open", () => {
    /* @Given two session keys */
    const a = Session.open(authKey());
    const b = Session.open(authKey());

    /* @When the sessions are opened */
    /* @Then the identifiers should be distinct */
    assertNotEquals(a.id.value, b.id.value);
  });
});

describe("Session.isExpired", () => {
  it("should not be expired immediately after opening", () => {
    /* @Given a newly opened session */
    const session = Session.open(authKey());

    /* @When the expiration state is checked */
    /* @Then the session should not be expired */
    assertEquals(session.isExpired(), false);
  });

  it("should be expired after TTL elapses", () => {
    /* @Given a session whose expiration is in the past */
    const session = new Session(
      new Id(),
      new Key("test-key"),
      new Expiration(new Instant(new Date(Date.now() - 1))),
    );

    /* @When the expiration state is checked */
    /* @Then the session should be expired */
    assertEquals(session.isExpired(), true);
  });
});

describe("Session.renew", () => {
  it("should return a new session with the same id", () => {
    /* @Given an existing session */
    const session = Session.open(authKey());

    /* @When the session is renewed */
    const renewed = session.renew();

    /* @Then the renewed session should have the same identifier */
    assertEquals(renewed.id.value, session.id.value);
  });

  it("should return a new session with extended expiration", () => {
    /* @Given an existing session */
    const session = Session.open(authKey());
    const previousExpiresAt = session.expiresAt.at.date.getTime();

    /* @When the session is renewed */
    const renewed = session.renew();

    /* @Then the renewed expiration should be equal to or later than the previous one */
    assert(renewed.expiresAt.at.date.getTime() >= previousExpiresAt);
  });
});
