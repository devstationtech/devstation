import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Vault } from "@server/vault/domain/models/vault.ts";
import { Name } from "@server/vault/domain/models/name.ts";
import { Name as SecretName } from "@server/vault/domain/models/secret/name.ts";
import { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import { Id as SecretId } from "@server/vault/domain/models/secret/id.ts";
import { Secret } from "@server/vault/domain/models/secret/secret.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { SecretAlreadyExists } from "@server/vault/domain/exceptions/secret-already-exists.ts";
import { SecretNotFound } from "@server/vault/domain/exceptions/secret-not-found.ts";

const ENCRYPTED = new Encrypted("aabbcc:ddeeff");
let counter = 0;

function makeSecret(name?: string): Secret {
  return new Secret(
    new SecretId(),
    new SecretName(name ?? `secret-${++counter}`),
    ENCRYPTED,
    null,
    Creation.now(new User("test-user"), new Hostname("test-host")),
  );
}

function makeVault(name = "production"): Vault {
  return Vault.create(
    new Name(name),
    Creation.now(new User("test-user"), new Hostname("test-host")),
  );
}

describe("Vault.create", () => {
  it("should create an empty vault with the given name", () => {
    /* @Given a valid vault name */
    /* @When the vault is created */
    const vault = makeVault("staging");

    /* @Then the vault should contain the name and no secrets */
    assertEquals(vault.name.value, "staging");
    assertEquals(vault.secrets.length, 0);
  });
});

describe("Vault.generate", () => {
  it("should add a secret to the vault", () => {
    /* @Given an empty vault and a secret */
    const vault = makeVault();

    /* @When the secret is generated */
    vault.generate(makeSecret("my-secret"));

    /* @Then the vault should contain the secret */
    assertEquals(vault.secrets.length, 1);
    assertEquals(vault.secrets[0].name.value, "my-secret");
  });

  it("should increment version after generate", () => {
    /* @Given a vault with initial version */
    const vault = makeVault();
    const initialVersion = vault.version.value;

    /* @When a secret is generated */
    vault.generate(makeSecret());

    /* @Then the version should have been incremented */
    assertEquals(vault.version.value, initialVersion + 1);
  });

  it("should accumulate multiple secrets", () => {
    /* @Given an empty vault */
    const vault = makeVault();

    /* @When multiple secrets are generated */
    vault.generate(makeSecret("alpha"));
    vault.generate(makeSecret("beta"));
    vault.generate(makeSecret("gamma"));

    /* @Then all should be present */
    assertEquals(vault.secrets.length, 3);
    assertEquals(vault.secrets.map((s) => s.name.value).sort(), ["alpha", "beta", "gamma"]);
  });

  it("should reject a secret with a duplicate name", () => {
    /* @Given a vault with an existing secret */
    const vault = makeVault();
    vault.generate(makeSecret("same-name"));

    /* @When the same name is used again */
    /* @Then an exception should be thrown */
    assertThrows(() => vault.generate(makeSecret("same-name")), SecretAlreadyExists);
  });
});

describe("Vault.delete", () => {
  it("should delete an existing secret", () => {
    /* @Given a vault with one secret */
    const vault = makeVault();
    vault.generate(makeSecret("to-remove"));
    const secretId = vault.secrets[0].id;

    /* @When the secret is deleted */
    vault.delete(secretId);

    /* @Then the vault should no longer contain the secret */
    assertEquals(vault.secrets.length, 0);
  });

  it("should delete only the targeted secret", () => {
    /* @Given a vault with multiple secrets */
    const vault = makeVault();
    vault.generate(makeSecret("keep-1"));
    vault.generate(makeSecret("remove-me"));
    vault.generate(makeSecret("keep-2"));
    const targetId = vault.secrets.find((s) => s.name.value === "remove-me")!.id;

    /* @When the target secret is deleted */
    vault.delete(targetId);

    /* @Then only it should have been deleted */
    assertEquals(vault.secrets.length, 2);
    assertEquals(vault.secrets.some((s) => s.name.value === "remove-me"), false);
    assertEquals(vault.secrets.some((s) => s.name.value === "keep-1"), true);
    assertEquals(vault.secrets.some((s) => s.name.value === "keep-2"), true);
  });

  it("should increment version after delete", () => {
    /* @Given a vault with one secret */
    const vault = makeVault();
    vault.generate(makeSecret());
    const versionAfterGenerate = vault.version.value;
    const secretId = vault.secrets[0].id;

    /* @When the secret is deleted */
    vault.delete(secretId);

    /* @Then the version should have been incremented */
    assertEquals(vault.version.value, versionAfterGenerate + 1);
  });

  it("should throw when removing a non-existent secret", () => {
    /* @Given an empty vault */
    const vault = makeVault();

    /* @When removal is attempted with a nonexistent id */
    /* @Then an exception should be thrown */
    assertThrows(() => vault.delete(new SecretId()), SecretNotFound);
  });
});
