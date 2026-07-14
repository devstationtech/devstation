import { AccessToken } from "@server/auth/domain/models/access-token/access-token.ts";
import type { GenerateAccessToken } from "@server/auth/application/commands/generate-access-token.ts";
import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";
import type { KeyWrap } from "@server/auth/domain/ports/outbound/key-wrap.ts";
import type { TokenStore } from "@server/auth/domain/ports/outbound/token-store.ts";

/**
 * Mints a scoped access token from an authenticated session.
 *
 * `Sessions.get` throws when the session is missing/expired — so a
 * token can only be minted by an authenticated operator. The session's
 * vault key is sealed via `KeyWrap` (never the password), and the
 * token replaces any previously stored one.
 */
export class GenerateAccessTokenHandler {
  constructor(
    private readonly sessions: Sessions,
    private readonly keyWrap: KeyWrap,
    private readonly tokenStore: TokenStore,
  ) {}

  async handle(command: GenerateAccessToken): Promise<AccessToken> {
    const session = this.sessions.get(command.sessionId);
    const wrappedKey = await this.keyWrap.wrap(session.key);
    const token = AccessToken.issue({
      purpose: command.purpose,
      scopes: command.scopes(),
      wrappedKey,
      ttlDays: command.ttlDays,
    });
    await this.tokenStore.save(token);
    return token;
  }
}
