import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Verify } from "@server/blueprint/domain/models/step/verify.ts";

/**
 * The Verify VO models the health probe of a step. It validates all
 * three fields at construction so an invalid config can't sneak in
 * via the parser. These tests pin each rule.
 */
describe("Verify constructor", () => {
  it("constructs successfully with a non-empty shell and valid retry settings", () => {
    /* @Given shell="...", retryCount=3, retryIntervalSeconds=2 */
    /* @When Verify is constructed */
    /* @Then no error is thrown and fields are exposed as-is */
    const v = new Verify("command -v docker", 3, 2);
    assertEquals(v.shell, "command -v docker");
    assertEquals(v.retryCount, 3);
    assertEquals(v.retryIntervalSeconds, 2);
  });

  it("accepts retryCount=1 (the minimum allowed) and retryIntervalSeconds=0", () => {
    /* @Given the boundary values (min retry, zero interval) */
    /* @When Verify is constructed */
    /* @Then it builds — no rule is exclusive on the lower bound */
    const v = new Verify("x", 1, 0);
    assertEquals(v.retryCount, 1);
    assertEquals(v.retryIntervalSeconds, 0);
  });

  it("rejects an empty shell", () => {
    /* @Given shell="" */
    /* @When Verify is constructed */
    /* @Then it throws — a health probe must have a command to run */
    assertThrows(() => new Verify("", 1, 0), Error, "verify.shell is required");
  });

  it("rejects retryCount < 1 (zero, negative)", () => {
    /* @When Verify is constructed with retryCount below the minimum */
    /* @Then it throws — at least one attempt is required */
    assertThrows(() => new Verify("x", 0, 0), Error, "retryCount");
    assertThrows(() => new Verify("x", -1, 0), Error, "retryCount");
  });

  it("rejects non-integer retryCount (1.5, NaN)", () => {
    /* @When Verify is constructed with a fractional retry count */
    /* @Then it throws — retryCount must be a whole number */
    assertThrows(() => new Verify("x", 1.5, 0), Error, "integer");
    assertThrows(() => new Verify("x", NaN, 0), Error);
  });

  it("rejects negative retryIntervalSeconds", () => {
    /* @When Verify is constructed with negative interval */
    /* @Then it throws — sleeping a negative duration is meaningless */
    assertThrows(() => new Verify("x", 1, -0.001), Error, "retryIntervalSeconds");
  });

  it("rejects non-finite retryIntervalSeconds (Infinity, NaN)", () => {
    /* @When the interval is non-finite */
    /* @Then it throws — would block the installer forever */
    assertThrows(() => new Verify("x", 1, Infinity), Error);
    assertThrows(() => new Verify("x", 1, NaN), Error);
  });
});
