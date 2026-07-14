import type { RenameVault } from "@server/vault/application/commands/rename-vault.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import { Id as VaultId } from "@server/vault/domain/models/id.ts";
import { Name } from "@server/vault/domain/models/name.ts";

export class RenameVaultHandler {
  constructor(private readonly vaults: Vaults) {}

  async handle(command: RenameVault): Promise<void> {
    const vault = await this.vaults.of(new VaultId(command.vaultId));
    vault.rename(new Name(command.name));
    await this.vaults.save(vault);
  }
}
