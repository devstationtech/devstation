import type { RenameSecret } from "@server/vault/application/commands/rename-secret.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import { Id as VaultId } from "@server/vault/domain/models/id.ts";
import { Id as SecretId } from "@server/vault/domain/models/secret/id.ts";
import { Name as SecretName } from "@server/vault/domain/models/secret/name.ts";

export class RenameSecretHandler {
  constructor(private readonly vaults: Vaults) {}

  async handle(command: RenameSecret): Promise<void> {
    const vault = await this.vaults.of(new VaultId(command.vaultId));
    vault.renameSecret(new SecretId(command.secretId), new SecretName(command.name));
    await this.vaults.save(vault);
  }
}
