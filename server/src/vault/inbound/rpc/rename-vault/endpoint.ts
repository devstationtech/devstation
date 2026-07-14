import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { VaultRenameRequest, VaultRenameResponse } from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { RenameVaultHandler } from "@server/vault/application/handlers/rename-vault-handler.ts";
import { RenameVault } from "@server/vault/application/commands/rename-vault.ts";

export class RenameVaultEndpoint
  implements ProtectedEndpoint<"vault.rename", VaultRenameRequest, VaultRenameResponse> {
  readonly method = "vault.rename" as const;

  constructor(private readonly handler: RenameVaultHandler) {}

  async dispatch(request: VaultRenameRequest): Promise<VaultRenameResponse> {
    await this.handler.handle(new RenameVault(request.vaultId, request.name));
    return {};
  }
}
