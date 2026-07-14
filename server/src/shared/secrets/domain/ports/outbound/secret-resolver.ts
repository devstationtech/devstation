import type { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import type { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

export interface SecretResolver {
  /** Resolve a secret VO within a vault. Returns null if missing. */
  resolve(vault: Vault, secret: Secret): Promise<string | null>;
}
