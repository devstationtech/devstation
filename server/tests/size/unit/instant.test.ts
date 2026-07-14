import { assert, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";

describe("Instant", () => {
  it("should accept a valid ISO string via fromString", () => {
    /* @Given a valid ISO string */
    const iso = "2026-01-01T00:00:00.000Z";

    /* @When the instant is built from that string */
    const instant = Instant.fromString(iso);

    /* @Then the value should be preserved */
    assert(instant.toString() === iso);
  });

  it("should reject an invalid date string", () => {
    /* @Given an invalid date string */
    const invalid = "not-a-date";

    /* @When the instant is built from that string */
    /* @Then an exception should be thrown */
    assertThrows(() => Instant.fromString(invalid), Error, "invalid instant value");
  });

  it("should reject an invalid Date object", () => {
    /* @Given an invalid Date object */
    const date = new Date("invalid");

    /* @When the instant is built with that object */
    /* @Then an exception should be thrown */
    assertThrows(() => new Instant(date), Error, "invalid instant value");
  });
});
