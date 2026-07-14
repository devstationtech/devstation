import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Vault } from "@server/vault/domain/models/vault.ts";
import { Id as VaultId } from "@server/vault/domain/models/id.ts";
import { Name } from "@server/vault/domain/models/name.ts";
import { Secret } from "@server/vault/domain/models/secret/secret.ts";
import { Id as SecretId } from "@server/vault/domain/models/secret/id.ts";
import { Name as SecretName } from "@server/vault/domain/models/secret/name.ts";
import { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { SecretAlreadyExists } from "@server/vault/domain/exceptions/secret-already-exists.ts";
import { SecretNotFound } from "@server/vault/domain/exceptions/secret-not-found.ts";

/**
 * In-place rename keeps the id (and every service reference to it) intact —
 * unlike delete+recreate, which mints a new id and breaks input refs. Pinned
 * for both the vault name and its secrets.
 */

const creation = () => Creation.now(new User("u"), new Hostname("h"));
const secret = (id: string, name: string) =>
  new Secret(new SecretId(id), new SecretName(name), new Encrypted("iv:ct"), null, creation());
const S1 = "11111111-1111-1111-1111-111111111111";
const S2 = "22222222-2222-2222-2222-222222222222";

function vaultWith(secrets = [secret(S1, "npm-admin-password")]): Vault {
  return new Vault(new VaultId(), new Name("homelab-core"), creation(), secrets);
}

describe("Vault.rename", () => {
  it("changes the name but keeps the id", () => {
    const v = Vault.create(new Name("homelab-core"), creation());
    const id = v.id.value;
    v.rename(new Name("tooling"));
    assertEquals(v.name.value, "tooling");
    assertEquals(v.id.value, id);
  });
});

describe("Vault.renameSecret", () => {
  it("renames a secret in place, preserving its id and value", () => {
    const v = vaultWith([secret(S1, "npm-admin-password")]);
    v.renameSecret(new SecretId(S1), new SecretName("tooling-npm-admin-password"));
    const s = v.secrets.find((x) => x.id.value === S1)!;
    assertEquals(s.name.value, "tooling-npm-admin-password");
    assertEquals(s.id.value, S1); // id unchanged → service refs keep working
    assertEquals(s.value.value, "iv:ct");
  });

  it("throws when the secret is absent", () => {
    const v = vaultWith();
    assertThrows(
      () => v.renameSecret(new SecretId(S2), new SecretName("x")),
      SecretNotFound,
    );
  });

  it("rejects renaming onto a name another secret already holds", () => {
    const v = vaultWith([secret(S1, "a"), secret(S2, "b")]);
    assertThrows(
      () => v.renameSecret(new SecretId(S1), new SecretName("b")),
      SecretAlreadyExists,
    );
  });

  it("allows a no-op rename to the secret's own name", () => {
    const v = vaultWith([secret(S1, "a")]);
    v.renameSecret(new SecretId(S1), new SecretName("a"));
    assertEquals(v.secrets[0].name.value, "a");
  });
});
