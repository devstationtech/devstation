import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

describe("Credential — configured vs none", () => {
  it("none() is not configured", () => {
    /* @Given the not-configured credential */
    const credential = Credential.none();

    /* @Then it reports unconfigured and carries the persisted marker */
    assertEquals(credential.isConfigured(), false);
    assertEquals(credential.vault.value, Credential.UNCONFIGURED_ID);
  });

  it("a credential with real vault references is configured", () => {
    /* @Given references to actual vault entries */
    const credential = new Credential(new Vault(), new Secret(), new Secret());

    /* @Then it reports configured */
    assertEquals(credential.isConfigured(), true);
  });

  it("any single unconfigured reference makes the whole credential unconfigured", () => {
    /* @Given a credential whose password reference is the marker */
    const credential = new Credential(
      new Vault(),
      new Secret(),
      new Secret(Credential.UNCONFIGURED_ID),
    );

    /* @Then it is not configured */
    assertEquals(credential.isConfigured(), false);
  });
});
