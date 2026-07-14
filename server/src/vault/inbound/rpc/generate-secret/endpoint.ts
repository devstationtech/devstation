import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { AuthenticatedSession } from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import type {
  VaultSecretsGenerateRequest,
  VaultSecretsGenerateResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { GenerateSecretHandler } from "@server/vault/application/handlers/generate-secret-handler.ts";
import { GenerateSecret } from "@server/vault/application/commands/generate-secret.ts";

export class GenerateSecretEndpoint implements
  ProtectedEndpoint<
    "vault.secrets.generate",
    VaultSecretsGenerateRequest,
    VaultSecretsGenerateResponse
  > {
  readonly method = "vault.secrets.generate" as const;

  constructor(private readonly handler: GenerateSecretHandler) {}

  async dispatch(
    request: VaultSecretsGenerateRequest,
    session: AuthenticatedSession,
  ): Promise<VaultSecretsGenerateResponse> {
    await this.handler.handle(
      new GenerateSecret(
        request.vaultId,
        request.name,
        session.key,
        request.hostname,
        request.user,
        request.value ?? null,
        request.description ?? null,
      ),
    );
    return {};
  }
}
