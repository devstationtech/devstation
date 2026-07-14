import type { DeleteVault } from "@server/vault/application/commands/delete-vault.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import { Id } from "@server/vault/domain/models/id.ts";

export class DeleteVaultHandler {
  constructor(private readonly vaults: Vaults) {}

  async handle(command: DeleteVault): Promise<void> {
    await this.vaults.remove(new Id(command.id));
  }
}
