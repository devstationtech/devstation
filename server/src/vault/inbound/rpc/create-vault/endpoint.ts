import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { VaultCreateRequest, VaultCreateResponse } from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { CreateVaultHandler } from "@server/vault/application/handlers/create-vault-handler.ts";
import { CreateVault } from "@server/vault/application/commands/create-vault.ts";

export class CreateVaultEndpoint
  implements ProtectedEndpoint<"vault.create", VaultCreateRequest, VaultCreateResponse> {
  readonly method = "vault.create" as const;

  constructor(private readonly handler: CreateVaultHandler) {}

  async dispatch(request: VaultCreateRequest): Promise<VaultCreateResponse> {
    await this.handler.handle(new CreateVault(request.name, request.user, request.hostname));
    return {};
  }
}
