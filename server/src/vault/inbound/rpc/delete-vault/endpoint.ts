import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { VaultDeleteRequest, VaultDeleteResponse } from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { DeleteVaultHandler } from "@server/vault/application/handlers/delete-vault-handler.ts";
import { DeleteVault } from "@server/vault/application/commands/delete-vault.ts";

export class DeleteVaultEndpoint
  implements ProtectedEndpoint<"vault.delete", VaultDeleteRequest, VaultDeleteResponse> {
  readonly method = "vault.delete" as const;

  constructor(private readonly handler: DeleteVaultHandler) {}

  async dispatch(request: VaultDeleteRequest): Promise<VaultDeleteResponse> {
    await this.handler.handle(new DeleteVault(request.vaultId));
    return {};
  }
}
