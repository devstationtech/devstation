import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Key } from "@server/vault/domain/models/key.ts";
import { Description } from "@server/vault/domain/models/secret/description.ts";

/**
 * Vault value objects — small required-string guards. `Key` names a
 * secret slot inside a vault; `Description` labels a secret. Both
 * reject empty so a half-built secret can never be persisted.
 */

describe("Vault Key", () => {
  it("accepts a non-empty key name", () => {
    assertEquals(new Key("db-password").value, "db-password");
  });

  it("rejects an empty value", () => {
    /* @Given an empty string */
    /* @When Key is constructed */
    /* @Then it throws — a secret slot must be addressable by name */
    assertThrows(() => new Key(""), Error, "key is required");
  });
});

describe("Secret Description", () => {
  it("accepts a non-empty description", () => {
    assertEquals(
      new Description("Postgres superuser password").value,
      "Postgres superuser password",
    );
  });

  it("rejects an empty value", () => {
    /* @Given an empty string */
    /* @When Description is constructed */
    /* @Then it throws — a secret is always labelled for the operator */
    assertThrows(() => new Description(""), Error, "description is required");
  });
});
