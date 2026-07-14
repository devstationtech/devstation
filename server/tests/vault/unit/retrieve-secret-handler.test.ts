import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { RetrieveSecretHandler } from "@server/vault/application/handlers/retrieve-secret-handler.ts";
import { RetrieveSecret } from "@server/vault/application/commands/retrieve-secret.ts";
import { VaultNotFound } from "@server/vault/domain/exceptions/vault-not-found.ts";
import { Vault } from "@server/vault/domain/models/vault.ts";
import { Name as VaultName } from "@server/vault/domain/models/name.ts";
import { Secret } from "@server/vault/domain/models/secret/secret.ts";
import { Id as SecretId } from "@server/vault/domain/models/secret/id.ts";
import { Name as SecretName } from "@server/vault/domain/models/secret/name.ts";
import { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import { Value } from "@server/vault/domain/models/secret/value.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import type { Crypto } from "@server/vault/domain/ports/outbound/crypto.ts";

/**
 * RetrieveSecretHandler is the security-critical reader complement
 * to GenerateSecretHandler. Pins four branches:
 *  - happy path: vault present, secret present → decrypt is called
 *    with the session's key, plaintext is returned;
 *  - vault missing: VaultNotFound is swallowed → returns null
 *    (the UI surfaces "no such vault" without an unhandled exception);
 *  - secret missing inside a found vault → returns null (the wire
 *    contract; not a throw);
 *  - other Vaults.of errors (e.g. corrupt file) propagate — only
 *    VaultNotFound is swallowed.
 */

const aKey = "deadbeef".repeat(8);

function fakeCrypto(opts: { fails?: boolean } = {}): { crypto: Crypto; decryptCalls: number } {
  let calls = 0;
  const result = {
    decryptCalls: 0,
    get crypto(): Crypto {
      return {
        encrypt: () => Promise.reject(new Error("not used")),
        // deno-lint-ignore require-await -- stub satisfies the async Crypto port
        async decrypt(encrypted: Encrypted, key: { value: string }): Promise<Value> {
          calls++;
          result.decryptCalls = calls;
          if (opts.fails) throw new Error("auth tag mismatch");
          // Echo plaintext as the ciphertext content after a known prefix tag —
          // simple and lets the test assert the full chain.
          return new Value(`dec(${key.value.slice(0, 8)}):${encrypted.value}`);
        },
      };
    },
  };
  return result;
}

function aVaultWithSecret(secretId: string, ciphertext = "iv:cipher"): Vault {
  const vault = Vault.create(
    new VaultName("homelab-secrets"),
    new Creation(
      new User("alice"),
      new Hostname("workstation"),
      Instant.fromString("2026-01-01T00:00:00.000Z"),
    ),
  );
  // Seed a secret directly via generate (vault.generate is the public mutation
  // entry — uses checkExists then push).
  vault.generate(
    new Secret(
      new SecretId(secretId),
      new SecretName("k3s-token"),
      new Encrypted(ciphertext),
      null,
      new Creation(
        new User("alice"),
        new Hostname("workstation"),
        Instant.fromString("2026-01-01T00:00:00.000Z"),
      ),
    ),
  );
  return vault;
}

function vaultsReturning(vault: Vault | "not-found" | Error): Vaults {
  // deno-lint-ignore no-explicit-any
  const stub: any = {
    of: () => {
      if (vault === "not-found") return Promise.reject(new VaultNotFound());
      if (vault instanceof Error) return Promise.reject(vault);
      return Promise.resolve(vault);
    },
    byName: () => Promise.resolve(null),
    save: () => Promise.resolve(),
    exists: () => Promise.resolve(true),
    remove: () => Promise.resolve(),
  };
  return stub as Vaults;
}

describe("RetrieveSecretHandler — happy path", () => {
  it("decrypts the ciphertext with the session key and returns the plaintext", async () => {
    /* @Given a vault holding one secret with known ciphertext */
    const sid = "00000000-0000-0000-0000-000000000001";
    const vault = aVaultWithSecret(sid, "iv1:cipher-1");
    const cryptoStub = fakeCrypto();
    const handler = new RetrieveSecretHandler(vaultsReturning(vault), cryptoStub.crypto);

    /* @When retrieve is invoked with the right secretId + session key */
    const got = await handler.handle(new RetrieveSecret(vault.id.value, sid, aKey));

    /* @Then decrypt was called once + the returned value carries the decrypted plaintext */
    assertEquals(cryptoStub.decryptCalls, 1);
    assertEquals(got, `dec(${aKey.slice(0, 8)}):iv1:cipher-1`);
  });
});

describe("RetrieveSecretHandler — null returns (not thrown)", () => {
  it("returns null when the vault is not found (VaultNotFound is swallowed)", async () => {
    /* @Given a Vaults port that rejects with VaultNotFound */
    const handler = new RetrieveSecretHandler(
      vaultsReturning("not-found"),
      fakeCrypto().crypto,
    );
    /* @When retrieve runs */
    const got = await handler.handle(
      new RetrieveSecret("00000000-0000-0000-0000-000000000099", "x", aKey),
    );
    /* @Then null — the UI shows "no such vault" cleanly */
    assertEquals(got, null);
  });

  it("returns null when the vault is found but the secret id is unknown", async () => {
    /* @Given a vault that holds 'sec-real' only */
    const vault = aVaultWithSecret("00000000-0000-0000-0000-000000000001");
    const cryptoStub = fakeCrypto();
    const handler = new RetrieveSecretHandler(vaultsReturning(vault), cryptoStub.crypto);
    /* @When retrieve is called with an unknown secretId */
    const got = await handler.handle(
      new RetrieveSecret(vault.id.value, "00000000-0000-0000-0000-0000000000ff", aKey),
    );
    /* @Then null — and decrypt is NEVER called (no plaintext could leak via timing) */
    assertEquals(got, null);
    assertEquals(cryptoStub.decryptCalls, 0);
  });
});

describe("RetrieveSecretHandler — error propagation", () => {
  it("propagates non-VaultNotFound errors from Vaults.of (e.g. corrupt file)", async () => {
    /* @Given a Vaults port that throws a generic error (NOT VaultNotFound) */
    const handler = new RetrieveSecretHandler(
      vaultsReturning(new Error("corrupt vault file")),
      fakeCrypto().crypto,
    );
    /* @When retrieve runs */
    /* @Then the error propagates — only VaultNotFound is swallowed to null */
    await assertRejects(
      () => handler.handle(new RetrieveSecret("00000000-0000-0000-0000-000000000099", "x", aKey)),
      Error,
      "corrupt vault file",
    );
  });

  it("propagates decrypt errors (wrong key / tampered ciphertext)", async () => {
    /* @Given a vault and a Crypto stub that always fails decryption */
    const sid = "00000000-0000-0000-0000-000000000001";
    const vault = aVaultWithSecret(sid);
    const handler = new RetrieveSecretHandler(
      vaultsReturning(vault),
      fakeCrypto({ fails: true }).crypto,
    );
    /* @When retrieve runs */
    /* @Then the decrypt error propagates (auth-tag failures are NOT silently mapped to null) */
    await assertRejects(
      () => handler.handle(new RetrieveSecret(vault.id.value, sid, aKey)),
      Error,
      "auth tag",
    );
  });
});
