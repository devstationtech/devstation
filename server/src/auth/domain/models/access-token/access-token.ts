import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { Id } from "@server/auth/domain/models/id.ts";
import type { Scope } from "@server/auth/domain/models/access-token/scope.ts";
import type { WrappedKey } from "@server/auth/domain/models/access-token/wrapped-key.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A scoped access token — a credential minted from an authenticated
 * session that lets a consumer (the MCP port) act with a subset of
 * the operator's capability, without the master password.
 *
 * It carries the vault key sealed as a `WrappedKey`: a holder can
 * decrypt the vault but can never recover the password (`K` is a
 * one-way Argon2 derivation). `scopes` bound what the holder may do;
 * `expiresAt` (optional) bounds for how long.
 */
export class AccessToken implements ValueObject {
  constructor(
    readonly id: Id,
    readonly purpose: string,
    readonly scopes: readonly Scope[],
    readonly wrappedKey: WrappedKey,
    readonly createdAt: Instant,
    /** `null` = never expires. */
    readonly expiresAt: Instant | null,
  ) {
    if (!purpose) throw new Error("access token purpose is required.");
  }

  /** Mints a fresh token. `ttlDays` null/undefined ⇒ never expires. */
  static issue(spec: {
    purpose: string;
    scopes: readonly Scope[];
    wrappedKey: WrappedKey;
    ttlDays?: number | null;
  }): AccessToken {
    const now = Date.now();
    const expiresAt = spec.ttlDays != null
      ? new Instant(new Date(now + spec.ttlDays * DAY_MS))
      : null;
    return new AccessToken(
      new Id(),
      spec.purpose,
      spec.scopes,
      spec.wrappedKey,
      new Instant(new Date(now)),
      expiresAt,
    );
  }

  isExpired(): boolean {
    return this.expiresAt !== null && Date.now() > this.expiresAt.date.getTime();
  }

  /** True when this token carries the given capability. */
  grants(scope: Scope): boolean {
    return this.scopes.some((s) => s.equals(scope));
  }
}
