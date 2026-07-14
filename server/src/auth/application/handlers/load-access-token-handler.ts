import type { AccessToken } from "@server/auth/domain/models/access-token/access-token.ts";
import type { TokenStore } from "@server/auth/domain/ports/outbound/token-store.ts";

/**
 * Loads the configured access token. An expired token resolves to
 * `null` — callers (the MCP boot) treat "expired" exactly as "no
 * token", falling back to the read-only surface.
 *
 * A handler, not an `application/queries/` slice: query slices are
 * raw read models (files → DTOs) and may not touch domain models or
 * ports; this loads a domain aggregate through a domain port.
 */
export class LoadAccessTokenHandler {
  constructor(private readonly tokenStore: TokenStore) {}

  async handle(): Promise<AccessToken | null> {
    const token = await this.tokenStore.load();
    if (!token || token.isExpired()) return null;
    return token;
  }
}
