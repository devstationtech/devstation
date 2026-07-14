import type { RetrieveSecret } from "@server/vault/application/commands/retrieve-secret.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import type { Crypto } from "@server/vault/domain/ports/outbound/crypto.ts";
import { Id } from "@server/vault/domain/models/id.ts";
import { Key } from "@server/vault/domain/models/key.ts";
import { VaultNotFound } from "@server/vault/domain/exceptions/vault-not-found.ts";

export class RetrieveSecretHandler {
  constructor(
    private readonly vaults: Vaults,
    private readonly crypto: Crypto,
  ) {}

  async handle(command: RetrieveSecret): Promise<string | null> {
    let vault;
    try {
      vault = await this.vaults.of(new Id(command.vaultId));
    } catch (error) {
      if (error instanceof VaultNotFound) return null;
      throw error;
    }
    const secret = vault.secrets.find((s) => s.id.value === command.secretId);
    if (!secret) return null;
    const key = new Key(command.key);
    const value = await this.crypto.decrypt(secret.value, key);
    return value.value;
  }
}
