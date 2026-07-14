import type { CreateVault } from "@server/vault/application/commands/create-vault.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import { Vault } from "@server/vault/domain/models/vault.ts";
import { VaultAlreadyExists } from "@server/vault/domain/exceptions/vault-already-exists.ts";
import { Name } from "@server/vault/domain/models/name.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";

export class CreateVaultHandler {
  constructor(private readonly vaults: Vaults) {}

  /**
   * Returns the freshly-minted vault id so MCP inbound can echo it to
   * the LLM caller. The RPC adapter ignores it for Ack-contract compatibility.
   */
  async handle(command: CreateVault): Promise<{ vaultId: string }> {
    const name = new Name(command.name);
    if (await this.vaults.exists(name)) throw new VaultAlreadyExists();
    const vault = Vault.create(
      name,
      Creation.now(new User(command.user), new Hostname(command.hostname)),
    );
    await this.vaults.save(vault);
    return { vaultId: vault.id.value };
  }
}
