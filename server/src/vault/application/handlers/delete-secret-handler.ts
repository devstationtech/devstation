import type { DeleteSecret } from "@server/vault/application/commands/delete-secret.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import { Id as VaultId } from "@server/vault/domain/models/id.ts";
import { Id } from "@server/vault/domain/models/secret/id.ts";

export class DeleteSecretHandler {
  constructor(private readonly vaults: Vaults) {}

  async handle(command: DeleteSecret): Promise<void> {
    const vault = await this.vaults.of(new VaultId(command.vaultId));
    vault.delete(new Id(command.secretId));
    await this.vaults.save(vault);
  }
}
