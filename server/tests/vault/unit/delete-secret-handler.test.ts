import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { DeleteSecretHandler } from "@server/vault/application/handlers/delete-secret-handler.ts";
import { DeleteSecret } from "@server/vault/application/commands/delete-secret.ts";
import { SecretNotFound } from "@server/vault/domain/exceptions/secret-not-found.ts";
import { Vault } from "@server/vault/domain/models/vault.ts";
import { Name as VaultName } from "@server/vault/domain/models/name.ts";
import { Secret } from "@server/vault/domain/models/secret/secret.ts";
import { Id as SecretId } from "@server/vault/domain/models/secret/id.ts";
import { Name as SecretName } from "@server/vault/domain/models/secret/name.ts";
import { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";

/**
 * DeleteSecretHandler is the simple end of vault.secrets.*. Three
 * branches pinned:
 *  - happy path: secret is removed and the vault is persisted;
 *  - unknown secret id → SecretNotFound bubbles AND the vault is
 *    NOT persisted (don't write a no-op snapshot);
 *  - unknown vault id → the underlying Vaults.of error propagates
 *    (caller maps to "not found" or similar).
 */

function aVaultWith(...secretIds: string[]): Vault {
  const vault = Vault.create(
    new VaultName("homelab"),
    new Creation(
      new User("alice"),
      new Hostname("workstation"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
  for (const id of secretIds) {
    vault.generate(
      new Secret(
        new SecretId(id),
        new SecretName(`secret-${id.slice(-4)}`),
        new Encrypted("iv:cipher"),
        null,
        new Creation(
          new User("alice"),
          new Hostname("workstation"),
          Instant.fromString("2026-01-01T00:00:00.000Z"),
        ),
      ),
    );
  }
  return vault;
}

function vaultsReturning(vault: Vault | Error): {
  vaults: Vaults;
  saved: Vault[];
} {
  const saved: Vault[] = [];
  return {
    saved,
    vaults: {
      of: () => vault instanceof Error ? Promise.reject(vault) : Promise.resolve(vault),
      byName: () => Promise.resolve(null),
      save: (v: Vault) => {
        saved.push(v);
        return Promise.resolve();
      },
      exists: () => Promise.resolve(true),
      remove: () => Promise.resolve(),
    },
  };
}

describe("DeleteSecretHandler — happy path", () => {
  it("deletes the matching secret and persists the vault once", async () => {
    /* @Given a vault with two secrets */
    const a = "00000000-0000-0000-0000-000000000001";
    const b = "00000000-0000-0000-0000-000000000002";
    const vault = aVaultWith(a, b);
    const { vaults, saved } = vaultsReturning(vault);
    const handler = new DeleteSecretHandler(vaults);
    /* @When remove targets 'a' */
    await handler.handle(new DeleteSecret(vault.id.value, a));
    /* @Then the vault was saved with only 'b' left */
    assertEquals(saved.length, 1);
    assertEquals(saved[0].secrets.map((s) => s.id.value), [b]);
  });
});

describe("DeleteSecretHandler — error paths", () => {
  it("rejects with SecretNotFound when the secret id is unknown AND does NOT save", async () => {
    /* @Given a vault with one secret */
    const a = "00000000-0000-0000-0000-000000000001";
    const vault = aVaultWith(a);
    const { vaults, saved } = vaultsReturning(vault);
    const handler = new DeleteSecretHandler(vaults);
    /* @When remove targets an unknown id */
    /* @Then SecretNotFound is raised AND nothing is persisted (no empty snapshot writes) */
    await assertRejects(
      () =>
        handler.handle(
          new DeleteSecret(vault.id.value, "00000000-0000-0000-0000-0000000000ff"),
        ),
      SecretNotFound,
    );
    assertEquals(saved.length, 0);
    /* @And the in-memory vault is unchanged */
    assertEquals(vault.secrets.length, 1);
  });

  it("propagates Vaults.of errors (e.g. vault not found) without saving", async () => {
    /* @Given a Vaults port that rejects (vault doesn't exist) */
    const { vaults, saved } = vaultsReturning(new Error("vault not found"));
    const handler = new DeleteSecretHandler(vaults);
    /* @When remove runs */
    /* @Then the error propagates; nothing is persisted */
    await assertRejects(
      () =>
        handler.handle(
          new DeleteSecret(
            "00000000-0000-0000-0000-000000000099",
            "00000000-0000-0000-0000-000000000001",
          ),
        ),
      Error,
      "vault not found",
    );
    assertEquals(saved.length, 0);
  });
});
