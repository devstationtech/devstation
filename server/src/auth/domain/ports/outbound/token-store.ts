import type { AccessToken } from "@server/auth/domain/models/access-token/access-token.ts";

/**
 * Persistence for the single access token the instance holds (today:
 * the MCP token at `${DEVSTATION_HOME}/mcp/token.json`). One token at a
 * time — `save` replaces, `remove` revokes.
 */
export interface TokenStore {
  save(token: AccessToken): Promise<void>;
  /** The persisted token, or `null` when none is configured. */
  load(): Promise<AccessToken | null>;
  remove(): Promise<void>;
}
