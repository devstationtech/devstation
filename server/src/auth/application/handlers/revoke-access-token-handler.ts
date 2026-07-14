import type { TokenStore } from "@server/auth/domain/ports/outbound/token-store.ts";

/**
 * Revokes the stored access token. Idempotent — revoking when no
 * token exists is a no-op. After revocation the MCP port falls back
 * to its read-only surface.
 */
export class RevokeAccessTokenHandler {
  constructor(private readonly tokenStore: TokenStore) {}

  handle(): Promise<void> {
    return this.tokenStore.remove();
  }
}
