import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { string } from "@server/blueprint/parser/parse/primitives/string.ts";
import { number } from "@server/blueprint/parser/parse/primitives/number.ts";
import { mapping } from "@server/blueprint/parser/parse/primitives/mapping.ts";

/**
 * The three parser primitives are the foundation under every other
 * parser. Their error messages embed the YAML path (`where`) so the
 * top-level error is always actionable. These tests pin the contract
 * + the path-substring so any future copy change is caught.
 */
describe("string primitive", () => {
  it("returns the value when given a non-empty string", () => {
    /* @Given a non-empty string value */
    /* @When string({value, where}) is called */
    /* @Then the same string is returned */
    assertEquals(string({ value: "hello", where: "x.y" }), "hello");
  });

  it("rejects empty string with a where-aware message", () => {
    /* @Given an empty string */
    /* @When string({}) is called */
    /* @Then it throws with the YAML path so the operator can find the key */
    assertThrows(() => string({ value: "", where: "x.y" }), Error, "x.y");
  });

  it("rejects non-string values (number, null, object, undefined)", () => {
    for (const v of [42, null, {}, undefined, true]) {
      assertThrows(() => string({ value: v, where: "x" }), Error, "required non-empty string");
    }
  });
});

describe("number primitive", () => {
  it("returns the value when given a finite number", () => {
    assertEquals(number({ value: 42, where: "x" }), 42);
    assertEquals(number({ value: 0, where: "x" }), 0);
    assertEquals(number({ value: -1.5, where: "x" }), -1.5);
  });

  it("rejects strings (no coercion) — typed YAML must be a number", () => {
    /* @Given a string that looks like a number ("42") */
    /* @When number() is called */
    /* @Then it throws — coercion is intentionally not done so YAML quoting bugs surface */
    assertThrows(() => number({ value: "42", where: "x" }), Error, "required number");
  });

  it("rejects NaN and infinities (only finite numbers pass)", () => {
    assertThrows(() => number({ value: NaN, where: "x" }), Error);
    assertThrows(() => number({ value: Infinity, where: "x" }), Error);
    assertThrows(() => number({ value: -Infinity, where: "x" }), Error);
  });

  it("rejects null/undefined/objects with a where-aware message", () => {
    for (const v of [null, undefined, {}, []]) {
      assertThrows(() => number({ value: v, where: "p.q" }), Error, "p.q");
    }
  });
});

describe("mapping primitive", () => {
  it("returns the same object when given a plain object", () => {
    /* @Given a plain object */
    const obj = { a: 1, b: "x" };
    /* @When mapping() is called */
    /* @Then the same object is returned (no copy) */
    assertEquals(mapping({ value: obj, where: "x" }), obj);
  });

  it("rejects arrays — YAML lists must not pass where a mapping is expected", () => {
    /* @Given an array value */
    /* @When mapping() is called */
    /* @Then it throws; arrays are not mappings even though they are objects in JS */
    assertThrows(() => mapping({ value: [1, 2], where: "x" }), Error, "required mapping");
  });

  it("rejects null (typeof null === 'object' in JS — must be excluded explicitly)", () => {
    assertThrows(() => mapping({ value: null, where: "x" }), Error, "required mapping");
  });

  it("rejects primitive values (string/number/boolean) with a where-aware message", () => {
    for (const v of ["x", 1, true]) {
      assertThrows(() => mapping({ value: v, where: "p.q" }), Error, "p.q");
    }
  });
});
