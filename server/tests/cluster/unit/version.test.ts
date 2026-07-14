import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";

describe("Version", () => {
  it("should accept a positive integer", () => {
    /* @Given a positive integer value */
    const value = 1;

    /* @When the version is built */
    const version = new Version(value);

    /* @Then the value should be accepted */
    assertEquals(version.value, value);
  });

  it("should reject zero", () => {
    /* @Given the value zero */
    const value = 0;

    /* @When the version is built with that value */
    /* @Then an exception should be thrown */
    assertThrows(() => new Version(value), Error, "positive integer");
  });

  it("should reject a negative value", () => {
    /* @Given a negative value */
    const value = -1;

    /* @When the version is built with that value */
    /* @Then an exception should be thrown */
    assertThrows(() => new Version(value), Error, "positive integer");
  });

  it("should reject a non-integer", () => {
    /* @Given a non-integer value */
    const value = 1.5;

    /* @When the version is built with that value */
    /* @Then an exception should be thrown */
    assertThrows(() => new Version(value), Error, "positive integer");
  });
});
