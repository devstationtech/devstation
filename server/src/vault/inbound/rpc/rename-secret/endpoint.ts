import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  VaultSecretsRenameRequest,
  VaultSecretsRenameResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { RenameSecretHandler } from "@server/vault/application/handlers/rename-secret-handler.ts";
import { RenameSecret } from "@server/vault/application/commands/rename-secret.ts";

export class RenameSecretEndpoint implements
  ProtectedEndpoint<
    "vault.secrets.rename",
    VaultSecretsRenameRequest,
    VaultSecretsRenameResponse
  > {
  readonly method = "vault.secrets.rename" as const;

  constructor(private readonly handler: RenameSecretHandler) {}

  async dispatch(request: VaultSecretsRenameRequest): Promise<VaultSecretsRenameResponse> {
    await this.handler.handle(new RenameSecret(request.vaultId, request.secretId, request.name));
    return {};
  }
}
