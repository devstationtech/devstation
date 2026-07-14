import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  AuthTokenRevokeRequest,
  AuthTokenRevokeResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import type { RevokeAccessTokenHandler } from "@server/auth/application/handlers/revoke-access-token-handler.ts";

/**
 * Endpoint `auth.token.revoke` — deletes the stored MCP access token.
 * Idempotent; the MCP port reverts to its read-only surface.
 */
export class RevokeTokenEndpoint implements
  ProtectedEndpoint<
    "auth.token.revoke",
    AuthTokenRevokeRequest,
    AuthTokenRevokeResponse
  > {
  readonly method = "auth.token.revoke" as const;

  constructor(private readonly handler: RevokeAccessTokenHandler) {}

  async dispatch(): Promise<AuthTokenRevokeResponse> {
    await this.handler.handle();
    return { revoked: true };
  }
}
