import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";

describe("Encrypted", () => {
  it("should accept a valid iv:ciphertext format", () => {
    /* @Given a valid encrypted value */
    const enc = new Encrypted("aabbcc:ddeeff");

    /* @Then the value should be stored */
    assertEquals(enc.value, "aabbcc:ddeeff");
  });

  it("should reject a value without ':'", () => {
    /* @Given a value without separator */
    /* @Then an exception should be thrown */
    assertThrows(() => new Encrypted("nodivider"), Error);
  });

  it("should reject an empty value", () => {
    /* @Given an empty value */
    /* @Then an exception should be thrown */
    assertThrows(() => new Encrypted(""), Error);
  });
});
