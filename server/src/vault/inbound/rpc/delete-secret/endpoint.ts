import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  VaultSecretsDeleteRequest,
  VaultSecretsDeleteResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { DeleteSecretHandler } from "@server/vault/application/handlers/delete-secret-handler.ts";
import { DeleteSecret } from "@server/vault/application/commands/delete-secret.ts";

export class DeleteSecretEndpoint implements
  ProtectedEndpoint<
    "vault.secrets.delete",
    VaultSecretsDeleteRequest,
    VaultSecretsDeleteResponse
  > {
  readonly method = "vault.secrets.delete" as const;

  constructor(private readonly handler: DeleteSecretHandler) {}

  async dispatch(request: VaultSecretsDeleteRequest): Promise<VaultSecretsDeleteResponse> {
    await this.handler.handle(new DeleteSecret(request.vaultId, request.secretId));
    return {};
  }
}
