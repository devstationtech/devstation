import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

/**
 * SSH credential — identifies a vault plus the secrets within it that hold
 * the username and password. Used by any context that needs to authenticate
 * against a remote host via SSH.
 *
 * "No credential configured" is part of the concept: persisted records use
 * the zero UUID as the not-configured marker, and consumers ask
 * `isConfigured()` instead of comparing raw sentinel strings.
 */
export class Credential implements ValueObject {
  /** Persisted marker for "not configured" (also valid for raw record checks). */
  static readonly UNCONFIGURED_ID = "00000000-0000-0000-0000-000000000000";

  constructor(
    readonly vault: Vault,
    readonly username: Secret,
    readonly password: Secret,
  ) {}

  /** The not-configured credential. */
  static none(): Credential {
    return new Credential(
      new Vault(Credential.UNCONFIGURED_ID),
      new Secret(Credential.UNCONFIGURED_ID),
      new Secret(Credential.UNCONFIGURED_ID),
    );
  }

  /** True when every reference points at a real vault entry. */
  isConfigured(): boolean {
    return this.vault.value !== Credential.UNCONFIGURED_ID &&
      this.username.value !== Credential.UNCONFIGURED_ID &&
      this.password.value !== Credential.UNCONFIGURED_ID;
  }
}
