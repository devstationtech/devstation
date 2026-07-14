import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Secrets } from "@server/station/domain/models/service/secrets.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

describe("Secrets VO", () => {
  it("should accept an empty record", () => {
    /* @Given no secret */
    /* @When building Secrets */
    const s = new Secrets({});

    /* @Then names returns an empty list */
    assertEquals(s.names().length, 0);
  });

  it("should expose has/get for declared secrets", () => {
    /* @Given a registered secret */
    const ref = new Secret();
    const s = new Secrets({ token: ref });

    /* @Then has/get should respond */
    assertEquals(s.has("token"), true);
    assertEquals(s.has("missing"), false);
    assertEquals(s.get("token").value, ref.value);
  });

  it("should throw on get for missing secret", () => {
    /* @Given an unregistered name */
    const s = new Secrets({});

    /* @Then get should throw */
    assertThrows(() => s.get("missing"), Error);
  });
});
