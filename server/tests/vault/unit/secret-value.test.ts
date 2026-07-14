import { assert, assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Value } from "@server/vault/domain/models/secret/value.ts";

describe("Value", () => {
  it("should accept a non-empty value", () => {
    /* @Given a non-empty value */
    const v = new Value("my-secret");

    /* @Then the value should be stored */
    assertEquals(v.value, "my-secret");
  });

  it("should reject an empty value", () => {
    /* @Given an empty value */
    /* @Then an exception should be thrown */
    assertThrows(() => new Value(""), Error);
  });
});

describe("Value.generate", () => {
  it("should generate a 32-character value", () => {
    /* @Given no input */
    /* @When a value is generated */
    const v = Value.generate();

    /* @Then the value should have 32 characters */
    assertEquals(v.value.length, 32);
  });

  it("should generate distinct values on each call", () => {
    /* @Given two generation calls */
    const a = Value.generate();
    const b = Value.generate();

    /* @Then the values should be distinct */
    assertNotEquals(a.value, b.value);
  });

  it("should generate values with valid charset", () => {
    /* @Given a generated value */
    const v = Value.generate();
    const charset = /^[a-zA-Z0-9!@#$%^&*]+$/;

    /* @Then the value should contain only characters from the charset */
    assert(charset.test(v.value));
  });
});
