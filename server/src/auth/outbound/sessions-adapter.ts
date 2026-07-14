import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";
import { Session } from "@server/auth/domain/models/session.ts";
import { Id } from "@server/auth/domain/models/id.ts";
import { Key } from "@server/auth/domain/models/key.ts";
import { Expiration } from "@server/auth/domain/models/expiration.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { Unauthenticated } from "@server/shared/authentication/domain/exceptions/unauthenticated.ts";

interface StoredSession {
  key: string;
  expiresAt: number;
}

export class SessionsAdapter implements Sessions {
  private readonly store = new Map<string, StoredSession>();
  private activeSessionId: string | null = null;

  save(session: Session): void {
    this.store.set(session.id.value, {
      key: session.key.value,
      expiresAt: session.expiresAt.at.date.getTime(),
    });
    this.activeSessionId = session.id.value;
  }

  active(): Session {
    if (!this.activeSessionId) throw new Unauthenticated();
    return this.get(this.activeSessionId);
  }

  get(id: string): Session {
    const stored = this.store.get(id);
    if (!stored) throw new Unauthenticated();
    if (Date.now() > stored.expiresAt) {
      this.store.delete(id);
      throw new Unauthenticated();
    }
    return new Session(
      new Id(id),
      new Key(stored.key),
      new Expiration(new Instant(new Date(stored.expiresAt))),
    );
  }
}
