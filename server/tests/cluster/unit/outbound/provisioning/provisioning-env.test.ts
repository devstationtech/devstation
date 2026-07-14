import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ProvisioningEnv } from "@server/cluster/outbound/executions/proxmox/provisioning/provisioning-env.ts";
import type { SessionResolver } from "@server/shared/authentication/domain/ports/outbound/session-resolver.ts";
import type { ResolvedCredential } from "@server/cluster/outbound/credential-resolver.ts";

/**
 * ProvisioningEnv keeps every provisioning secret off disk: the Proxmox
 * credential rides `TF_VAR_*` env, and `TF_ENCRYPTION` turns on OpenTofu's
 * native state + plan encryption with a passphrase derived from the vault key.
 * Pins: the credential is exposed as env; the passphrase is deterministic (so
 * previously-encrypted state stays readable) yet is never the literal vault
 * key; and the encryption config carries a migration fallback.
 */

function sessionWith(key: string): SessionResolver {
  return { resolve: () => key };
}

const credential: ResolvedCredential = { user: "tfops@pve", password: "s3cr3t-pw" };

describe("ProvisioningEnv.build", () => {
  it("carries the Proxmox credential as TF_VAR_* env, not on disk", async () => {
    /* @Given an active session key */
    const env = await new ProvisioningEnv(sessionWith("a".repeat(64))).build(credential);
    /* @Then the provider credential is exposed only through env */
    assertEquals(env.TF_VAR_proxmox_user, "tfops@pve");
    assertEquals(env.TF_VAR_proxmox_password, "s3cr3t-pw");
  });

  it("enables state AND plan encryption with a pbkdf2 method and a migration fallback", async () => {
    const env = await new ProvisioningEnv(sessionWith("b".repeat(64))).build(credential);
    const cfg = env.TF_ENCRYPTION;
    /* @Then both state and plan are encrypted via pbkdf2/aes_gcm */
    assertStringIncludes(cfg, 'key_provider "pbkdf2" "vault"');
    assertStringIncludes(cfg, 'method "aes_gcm" "vault"');
    assertStringIncludes(cfg, "state {");
    assertStringIncludes(cfg, "plan {");
    /* @And a read fallback keeps a pre-encryption plaintext state readable */
    assertStringIncludes(cfg, 'method "unencrypted" "migrate"');
    assertStringIncludes(cfg, "fallback");
  });

  it("derives a deterministic passphrase that is never the literal vault key", async () => {
    /* @Given the same vault key resolved twice */
    const key = "c".repeat(64);
    const a = await new ProvisioningEnv(sessionWith(key)).build(credential);
    const b = await new ProvisioningEnv(sessionWith(key)).build(credential);
    /* @Then the encryption config is byte-identical (state stays decryptable across runs) */
    assertEquals(a.TF_ENCRYPTION, b.TF_ENCRYPTION);
    /* @And the raw vault key never appears in the config (HKDF domain separation) */
    assertEquals(a.TF_ENCRYPTION.includes(key), false);
  });

  it("derives different passphrases for different vault keys", async () => {
    const a = await new ProvisioningEnv(sessionWith("d".repeat(64))).build(credential);
    const b = await new ProvisioningEnv(sessionWith("e".repeat(64))).build(credential);
    assertEquals(a.TF_ENCRYPTION === b.TF_ENCRYPTION, false);
  });
});
