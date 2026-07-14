import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Instance } from "@server/station/domain/models/service/instance.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Role } from "@server/station/domain/models/service/role.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";

describe("Instance", () => {
  it("should construct with role + host + credential", () => {
    /* @Given valid role, host, credential */
    /* @When building Instance */
    const i = new Instance(
      new Role("server"),
      "10.0.0.1",
      new Credential(new Vault(), new Secret(), new Secret()),
    );

    /* @Then the three properties should be preserved */
    assertEquals(i.role.name, "server");
    assertEquals(i.host, "10.0.0.1");
    assertEquals(i.credential instanceof Credential, true);
  });

  it("should reject empty host", () => {
    /* @Given an empty host */
    /* @Then it should throw */
    assertThrows(() =>
      new Instance(
        new Role("server"),
        "",
        new Credential(new Vault(), new Secret(), new Secret()),
      ), Error);
  });
});
