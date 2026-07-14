import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  AuthTokenCurrentRequest,
  AuthTokenCurrentResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import type { LoadAccessTokenHandler } from "@server/auth/application/handlers/load-access-token-handler.ts";

/**
 * Endpoint `auth.token.current` — reports the stored MCP access token
 * (id, scopes, timestamps), or `{ present: false }` when none is
 * configured. Never returns key material.
 */
export class CurrentTokenEndpoint implements
  ProtectedEndpoint<
    "auth.token.current",
    AuthTokenCurrentRequest,
    AuthTokenCurrentResponse
  > {
  readonly method = "auth.token.current" as const;

  constructor(private readonly handler: LoadAccessTokenHandler) {}

  async dispatch(): Promise<AuthTokenCurrentResponse> {
    const token = await this.handler.handle();
    if (!token) return { present: false };
    return {
      present: true,
      id: token.id.value,
      purpose: token.purpose,
      scopes: token.scopes.map((s) => s.value),
      createdAt: token.createdAt.toString(),
      expiresAt: token.expiresAt ? token.expiresAt.toString() : null,
    };
  }
}
