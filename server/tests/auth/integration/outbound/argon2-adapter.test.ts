import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Argon2Adapter } from "@server/auth/outbound/argon2-adapter.ts";
import { Password } from "@server/auth/domain/models/password.ts";
import { Persistence } from "@tests/auth/integration/outbound/persistence.ts";

describe("Argon2Adapter — integration", () => {
  let persistence: Persistence;
  let adapter: Argon2Adapter;

  beforeEach(() => {
    persistence = new Persistence();
    adapter = new Argon2Adapter(new FileSystem(persistence.dir));
  });

  afterEach(() => persistence.teardown());

  it("should not be configured before setup", async () => {
    /* @Given an adapter without prior configuration */
    /* @When the configuration state is checked */
    /* @Then the adapter should not be configured */
    assertEquals(await adapter.isConfigured(), false);
  });

  it("should return credentials after setup", async () => {
    /* @Given a valid password */
    const password = new Password("my-secret-passphrase");

    /* @When configuration is executed */
    const credential = await adapter.configure(password);

    /* @Then the credentials should contain a derived key */
    assertEquals(credential.value.length, 64);
  });

  it("should be configured after setup", async () => {
    /* @Given configuration has been executed */
    await adapter.configure(new Password("my-secret-passphrase"));

    /* @When the configuration state is checked */
    /* @Then the adapter should be configured */
    assertEquals(await adapter.isConfigured(), true);
  });

  it("should authenticate with correct password", async () => {
    /* @Given authentication has been configured */
    const password = new Password("my-secret-passphrase");
    await adapter.configure(password);
    const newAdapter = new Argon2Adapter(new FileSystem(persistence.dir));

    /* @When authentication is executed with the correct password */
    const credential = await newAdapter.authenticate(password);

    /* @Then the credentials should be returned */
    assertEquals(typeof credential?.value, "string");
    assertEquals(credential?.value.length, 64);
  });

  it("should derive the same encryption key for the same password", async () => {
    /* @Given authentication has been configured with a password */
    const password = new Password("my-secret-passphrase");
    const configured = await adapter.configure(password);
    const newAdapter = new Argon2Adapter(new FileSystem(persistence.dir));

    /* @When authentication is executed with the same password */
    const authenticated = await newAdapter.authenticate(password);

    /* @Then the derived key should be the same */
    assertEquals(authenticated?.value, configured.value);
  });

  it("should reject authentication with wrong password", async () => {
    /* @Given authentication has been configured */
    await adapter.configure(new Password("correct-horse-battery"));
    const newAdapter = new Argon2Adapter(new FileSystem(persistence.dir));

    /* @When authentication is attempted with the wrong password */
    const credential = await newAdapter.authenticate(new Password("wrong-horse-battery!"));

    /* @Then no credentials should be returned */
    assertEquals(credential, null);
  });
});
