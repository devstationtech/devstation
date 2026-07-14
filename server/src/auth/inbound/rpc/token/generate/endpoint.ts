import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  AuthTokenGenerateRequest,
  AuthTokenGenerateResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import type { GenerateAccessTokenHandler } from "@server/auth/application/handlers/generate-access-token-handler.ts";
import { GenerateAccessToken } from "@server/auth/application/commands/generate-access-token.ts";

/**
 * Endpoint `auth.token.generate` — mints a scoped MCP access token
 * from the calling session and persists it. Returns the token summary
 * (no key material).
 */
export class GenerateTokenEndpoint implements
  ProtectedEndpoint<
    "auth.token.generate",
    AuthTokenGenerateRequest,
    AuthTokenGenerateResponse
  > {
  readonly method = "auth.token.generate" as const;

  constructor(private readonly handler: GenerateAccessTokenHandler) {}

  async dispatch(request: AuthTokenGenerateRequest): Promise<AuthTokenGenerateResponse> {
    const token = await this.handler.handle(
      new GenerateAccessToken(
        request.sessionId,
        request.scopes,
        "mcp",
        // An absent/null ttl is normalised to the command's default
        // lifetime — the wire cannot mint a never-expiring token.
        request.ttlDays ?? null,
      ),
    );
    return {
      id: token.id.value,
      purpose: token.purpose,
      scopes: token.scopes.map((s) => s.value),
      createdAt: token.createdAt.toString(),
      expiresAt: token.expiresAt ? token.expiresAt.toString() : null,
    };
  }
}
