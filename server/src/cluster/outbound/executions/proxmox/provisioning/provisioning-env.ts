import type { ResolvedCredential } from "@server/cluster/outbound/credential-resolver.ts";
import type { SessionResolver } from "@server/shared/authentication/domain/ports/outbound/session-resolver.ts";

// Domain-separated HKDF context. The salt is fixed (not random) on purpose:
// the passphrase must be deterministic so state written by an earlier run
// stays decryptable, and the vault key is already full-entropy input.
const HKDF_INFO = new TextEncoder().encode("devstation-provisioning-state-v1");
const HKDF_SALT = new TextEncoder().encode("devstation-provisioning-state-salt-v1");

/**
 * Builds the environment for a provisioning run so that no credential is ever
 * written to disk in cleartext. Two concerns, both carried by env vars so
 * nothing sensitive lands in the working directory:
 *
 *  - **Proxmox API user/password** travel as `TF_VAR_*`. They configure the
 *    provider, which OpenTofu never persists to state — the only on-disk copy
 *    would otherwise have been the tfvars file.
 *  - **`TF_ENCRYPTION`** turns on OpenTofu's native state *and* plan encryption.
 *    The per-VM credentials that DO land in state (cloud-init user/password)
 *    and every variable value baked into the plan file are encrypted at rest.
 *
 * The encryption passphrase is derived from the operator's vault key via HKDF
 * (domain-separated, so the literal key never reaches the tofu process) and is
 * deterministic, so a previous run's encrypted state stays readable. A
 * permanent `unencrypted` read fallback keeps pre-encryption (plaintext) state
 * readable — writes always use the encrypted method — so turning this on never
 * breaks an existing state; it migrates it on the next apply.
 */
export class ProvisioningEnv {
  constructor(private readonly session: SessionResolver) {}

  async build(credential: ResolvedCredential): Promise<Record<string, string>> {
    const passphrase = await derivePassphrase(this.session.resolve());
    return {
      TF_VAR_proxmox_user: credential.user,
      TF_VAR_proxmox_password: credential.password,
      TF_ENCRYPTION: encryptionConfig(passphrase),
    };
  }
}

async function derivePassphrase(vaultKey: string): Promise<string> {
  const ikm = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(vaultKey),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: HKDF_INFO },
    ikm,
    256,
  );
  return toHex(new Uint8Array(bits));
}

/**
 * HCL body for `TF_ENCRYPTION` (OpenTofu merges it over any code config). An
 * `aes_gcm` method keyed by `pbkdf2(passphrase)` encrypts both state and plan;
 * each declares an `unencrypted` read fallback so a first run over plaintext
 * state migrates cleanly. The passphrase is a 64-char hex string — well past
 * pbkdf2's 16-char minimum, and safe to inline unquoted-escaped in HCL.
 */
function encryptionConfig(passphrase: string): string {
  return [
    'key_provider "pbkdf2" "vault" {',
    `  passphrase = "${passphrase}"`,
    "}",
    'method "aes_gcm" "vault" {',
    "  keys = key_provider.pbkdf2.vault",
    "}",
    'method "unencrypted" "migrate" {}',
    "state {",
    "  method = method.aes_gcm.vault",
    "  fallback { method = method.unencrypted.migrate }",
    "}",
    "plan {",
    "  method = method.aes_gcm.vault",
    "  fallback { method = method.unencrypted.migrate }",
    "}",
  ].join("\n");
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
