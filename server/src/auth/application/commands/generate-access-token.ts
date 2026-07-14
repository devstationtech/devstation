import { Scope } from "@server/auth/domain/models/access-token/scope.ts";

/**
 * Application command for minting a scoped access token. The handler
 * translates the raw scope strings into `Scope` VOs and resolves the
 * session behind `sessionId` for its vault key.
 */
export class GenerateAccessToken {
  /**
   * Default lifetime applied when the caller supplies no ttl. A token
   * seals the vault key, so an unbounded lifetime is never the implicit
   * default — an operator who omits a ttl gets a bounded token.
   * Never-expires stays a domain capability (`AccessToken.issue` with a
   * null ttl) but is deliberately not reachable through this command.
   */
  static readonly DEFAULT_TTL_DAYS = 90;

  readonly ttlDays: number;

  constructor(
    readonly sessionId: string,
    private readonly _scopes: readonly string[],
    readonly purpose: string,
    ttlDays: number | null = null,
  ) {
    this.ttlDays = ttlDays ?? GenerateAccessToken.DEFAULT_TTL_DAYS;
  }

  scopes(): Scope[] {
    return this._scopes.map((s) => new Scope(s));
  }
}
