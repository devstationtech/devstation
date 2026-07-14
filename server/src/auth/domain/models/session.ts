import { Id } from "@server/auth/domain/models/id.ts";
import type { Key } from "@server/auth/domain/models/key.ts";
import { Expiration } from "@server/auth/domain/models/expiration.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";

export const SESSION_TTL = 10 * 60 * 1000;

/** Far-future instant used for a never-expiring standing session. */
const NEVER = new Instant(new Date("9999-12-31T23:59:59.999Z"));

export class Session {
  constructor(
    readonly id: Id,
    readonly key: Key,
    readonly expiresAt: Expiration,
  ) {}

  isExpired(): boolean {
    return this.expiresAt.isExpired();
  }

  renew(): Session {
    return new Session(this.id, this.key, Expiration.after(SESSION_TTL));
  }

  static open(key: Key): Session {
    return new Session(new Id(), key, Expiration.after(SESSION_TTL));
  }

  /**
   * A long-lived session for a non-interactive holder of the vault
   * key — the MCP server boots one from its access token so the
   * in-process secret resolution works without a login. It expires
   * with the token (`until`), or never when the token never expires.
   */
  static standing(key: Key, until: Instant | null): Session {
    return new Session(new Id(), key, new Expiration(until ?? NEVER));
  }
}
