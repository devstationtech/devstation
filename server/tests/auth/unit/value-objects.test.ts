import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Key } from "@server/auth/domain/models/key.ts";

/**
 * Auth value objects — `Key` is the required-string guard for the
 * auth key material. Rejecting empty keeps a half-configured auth
 * state from ever being persisted.
 */

describe("Auth Key", () => {
  it("accepts a non-empty key value", () => {
    assertEquals(new Key("a1b2c3d4").value, "a1b2c3d4");
  });

  it("rejects an empty value", () => {
    /* @Given an empty string */
    /* @When Key is constructed */
    /* @Then it throws — auth must always carry key material */
    assertThrows(() => new Key(""), Error, "key is required");
  });
});
