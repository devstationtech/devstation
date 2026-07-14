import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { GenerateSecretHandler } from "@server/vault/application/handlers/generate-secret-handler.ts";
import { GenerateSecret } from "@server/vault/application/commands/generate-secret.ts";
import { SecretAlreadyExists } from "@server/vault/domain/exceptions/secret-already-exists.ts";
import { Vault } from "@server/vault/domain/models/vault.ts";
import { Name as VaultName } from "@server/vault/domain/models/name.ts";
import { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import type { Value } from "@server/vault/domain/models/secret/value.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import type { Crypto } from "@server/vault/domain/ports/outbound/crypto.ts";

/**
 * GenerateSecretHandler is the security-critical entry for adding /
 * replacing secrets. Pins three branches that matter:
 *  - happy path: a plaintext value is encrypted by Crypto with the
 *    session's key, and the resulting Secret is added to the Vault;
 *  - autogenerate: when `value` is null, Value.generate() is used
 *    (random secret — UI flow for "generate me one");
 *  - replaceIfExists semantics: default false → duplicate name throws
 *    SecretAlreadyExists; true → existing entry is purged and the
 *    new one takes its place (used by service-install listener).
 */

/** Crypto stub: tags the ciphertext with the key used so we can assert encryption ran with the right key. */
function fakeCrypto(): { crypto: Crypto; encryptCalls: number } {
  let calls = 0;
  const result = {
    encryptCalls: 0,
    get crypto(): Crypto {
      return {
        // deno-lint-ignore require-await -- stub satisfies the async Crypto port
        async encrypt(value: Value, key: { value: string }): Promise<Encrypted> {
          calls++;
          result.encryptCalls = calls;
          // Tag ciphertext so tests can assert which key was used and that the
          // plaintext was forwarded — without doing real AES.
          return new Encrypted(`enc(${key.value.slice(0, 8)}):${value.value}`);
        },
        decrypt: () => Promise.reject(new Error("not used")),
      };
    },
  };
  return result;
}

/** Tracks the vaults persisted via Vaults.save. */
function inMemoryVaults(seed: Vault): {
  vaults: Vaults;
  saved: Vault[];
} {
  const stored = seed;
  const saved: Vault[] = [];
  return {
    saved,
    vaults: {
      of: () => Promise.resolve(stored),
      byName: () => Promise.resolve(stored),
      save: (v: Vault) => {
        saved.push(v);
        return Promise.resolve();
      },
      exists: () => Promise.resolve(true),
      remove: () => Promise.resolve(),
    },
  };
}

function aVault(): Vault {
  return Vault.create(
    new VaultName("homelab-secrets"),
    new Creation(
      new User("alice"),
      new Hostname("workstation"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
}

const aValidKey = "deadbeef".repeat(8);

describe("GenerateSecretHandler — happy path", () => {
  it("encrypts the plaintext and adds a new Secret to the Vault", async () => {
    /* @Given a vault with no secrets + a Crypto stub */
    const vault = aVault();
    const { vaults, saved } = inMemoryVaults(vault);
    const cryptoStub = fakeCrypto();
    const handler = new GenerateSecretHandler(vaults, cryptoStub.crypto);

    /* @When generate runs with an explicit value */
    await handler.handle(
      new GenerateSecret(
        vault.id.value,
        "k3s-token",
        aValidKey,
        "workstation",
        "alice",
        "explicit-plain",
        null,
      ),
    );

    /* @Then crypto.encrypt was called once and the vault was saved with one secret */
    assertEquals(cryptoStub.encryptCalls, 1);
    assertEquals(saved.length, 1);
    assertEquals(saved[0].secrets.length, 1);
    assertEquals(saved[0].secrets[0].name.value, "k3s-token");
    /* @And the ciphertext shape proves the key + plaintext reached crypto.encrypt */
    assertEquals(
      saved[0].secrets[0].value.value,
      `enc(${aValidKey.slice(0, 8)}):explicit-plain`,
    );
  });

  it("auto-generates a random Value when the command's value is null (UI 'generate one for me')", async () => {
    /* @Given a vault and a Crypto stub */
    const vault = aVault();
    const { vaults, saved } = inMemoryVaults(vault);
    const handler = new GenerateSecretHandler(vaults, fakeCrypto().crypto);

    /* @When generate runs WITHOUT an explicit value */
    await handler.handle(
      new GenerateSecret(
        vault.id.value,
        "k3s-token",
        aValidKey,
        "workstation",
        "alice",
        null, // value = null → autogenerate via Value.generate()
        null,
      ),
    );

    /* @Then the vault was saved with a secret whose ciphertext exists (some plaintext was generated) */
    assertEquals(saved.length, 1);
    assertEquals(saved[0].secrets.length, 1);
    /* @And the ciphertext is non-trivial (proves the autogenerated value was forwarded) */
    assertEquals(saved[0].secrets[0].value.value.length > 16, true);
  });
});

describe("GenerateSecretHandler — replaceIfExists semantics", () => {
  it("throws SecretAlreadyExists when name collides AND replaceIfExists is false (default)", async () => {
    /* @Given a vault with a 'k3s-token' secret already present */
    const vault = aVault();
    vault.generate(
      // Stamp via the same handler to avoid hand-building a Secret
      // (handler is the only entry that produces a Secret externally).
      // deno-lint-ignore no-explicit-any
      { name: { value: "k3s-token" } } as any,
    );
    const { vaults, saved } = inMemoryVaults(vault);
    const handler = new GenerateSecretHandler(vaults, fakeCrypto().crypto);

    /* @When generate runs with the same name, replaceIfExists default false */
    /* @Then SecretAlreadyExists is raised AND no save happened (vault unchanged) */
    await assertRejects(
      () =>
        handler.handle(
          new GenerateSecret(
            vault.id.value,
            "k3s-token",
            aValidKey,
            "workstation",
            "alice",
            "x",
            null,
          ),
        ),
      SecretAlreadyExists,
    );
    assertEquals(saved.length, 0);
  });

  it("OVERWRITES the existing secret when replaceIfExists=true (idempotent re-write)", async () => {
    /* @Given a vault with a 'k3s-token' secret already present */
    const vault = aVault();
    // Seed using regenerate (overwrite-or-insert) — same effect as a previous generate.
    // deno-lint-ignore no-explicit-any
    vault.regenerate({ name: { value: "k3s-token" } } as any);
    const initialCount = vault.secrets.length;
    const { vaults, saved } = inMemoryVaults(vault);
    const handler = new GenerateSecretHandler(vaults, fakeCrypto().crypto);

    /* @When generate runs with the same name AND replaceIfExists=true */
    await handler.handle(
      new GenerateSecret(
        vault.id.value,
        "k3s-token",
        aValidKey,
        "workstation",
        "alice",
        "fresh-plaintext",
        null,
        /* replaceIfExists */ true,
      ),
    );

    /* @Then no SecretAlreadyExists; the entry was replaced (size unchanged); fresh ciphertext */
    assertEquals(saved.length, 1);
    assertEquals(saved[0].secrets.length, initialCount);
    const updated = saved[0].secrets.find((s) => s.name.value === "k3s-token")!;
    assertEquals(
      updated.value.value,
      `enc(${aValidKey.slice(0, 8)}):fresh-plaintext`,
    );
  });
});
