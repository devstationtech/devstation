import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  SLUG_DESCRIPTION,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  slugSchema,
} from "@server/shared/inbound/mcp/json-schema-slug.ts";
import { Slug } from "@server/shared/building-blocks/domain/models/value-objects/slug.ts";

/**
 * The MCP-facing `slugSchema` must mirror the domain `Slug` VO. If
 * the two ever drift, agents will pass inputs that the schema lets
 * through but the domain rejects (e.g., `test_underscore`, `Test-Caps`,
 * `test.dot` pass the schema but fail at the handler).
 *
 * Strategy: build the schema's regex once; then assert it accepts
 * everything the Slug VO accepts and rejects everything the VO
 * rejects. We use a small representative table covering the edge cases.
 */
describe("slugSchema — mirrors domain Slug VO", () => {
  const re = new RegExp(SLUG_PATTERN);

  function passesSchema(s: string): boolean {
    return s.length <= SLUG_MAX_LENGTH && re.test(s);
  }
  function passesDomain(s: string): boolean {
    try {
      new Slug(s);
      return true;
    } catch {
      return false;
    }
  }

  const cases = [
    "ds-v3-test", // ok (canonical)
    "ds-v3-test-1779757681", // ok (with digits)
    "a", // ok (single char)
    "z9", // ok
    "ds--", // INVALID (ends in -)
    "-leading", // INVALID (starts with -)
    "trailing-", // INVALID (ends with -)
    "Test-Caps", // INVALID (uppercase)
    "test_underscore", // INVALID (underscore)
    "test.dot", // INVALID (dot)
    "test space", // INVALID (space)
    "", // INVALID (empty)
    "x".repeat(64), // ok (max length)
    "x".repeat(65), // INVALID (over max)
  ];

  for (const c of cases) {
    it(`agrees with the domain VO on ${JSON.stringify(c)}`, () => {
      /* @Given the candidate string */
      /* @Then the schema and the domain Slug VO agree on acceptance */
      assertEquals(
        passesSchema(c),
        passesDomain(c),
        `schema=${passesSchema(c)} but domain=${passesDomain(c)} for ${JSON.stringify(c)}`,
      );
    });
  }

  it("ships a description that explains the rule", () => {
    /* @When the default slug schema is built */
    const s = slugSchema();
    /* @Then it carries the pattern, max length, and a non-empty description */
    assertEquals(s.type, "string");
    assertEquals(s.pattern, SLUG_PATTERN);
    assertEquals(s.maxLength, SLUG_MAX_LENGTH);
    assertEquals(s.description.length > 0, true);
    assertEquals(s.description, SLUG_DESCRIPTION);
  });

  it("lets callers override the description with context-specific text", () => {
    /* @When a custom description is passed */
    const s = slugSchema({ description: "Cluster name. Foo." });
    /* @Then the description is overridden but the constraint is unchanged */
    assertEquals(s.description, "Cluster name. Foo.");
    assertEquals(s.pattern, SLUG_PATTERN); // still the same constraint
  });
});
