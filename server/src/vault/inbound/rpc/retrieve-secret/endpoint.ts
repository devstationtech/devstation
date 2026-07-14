import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { AuthenticatedSession } from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import type {
  VaultSecretsRetrieveRequest,
  VaultSecretsRetrieveResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { RetrieveSecretHandler } from "@server/vault/application/handlers/retrieve-secret-handler.ts";
import { RetrieveSecret } from "@server/vault/application/commands/retrieve-secret.ts";

export class RetrieveSecretEndpoint implements
  ProtectedEndpoint<
    "vault.secrets.retrieve",
    VaultSecretsRetrieveRequest,
    VaultSecretsRetrieveResponse
  > {
  readonly method = "vault.secrets.retrieve" as const;

  constructor(private readonly handler: RetrieveSecretHandler) {}

  async dispatch(
    request: VaultSecretsRetrieveRequest,
    session: AuthenticatedSession,
  ): Promise<VaultSecretsRetrieveResponse> {
    const value = await this.handler.handle(
      new RetrieveSecret(request.vaultId, request.secretId, session.key),
    );
    return { value };
  }
}
