import type {
  AuthenticatedSession,
  Authentication,
} from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import type { Sessions } from "@server/auth/domain/ports/outbound/sessions.ts";

/**
 * Bridge from the shared Authentication port to auth's Sessions store.
 *
 * Lives in `shared/authentication/outbound/` (not `auth/outbound/`)
 * because it's a cross-cutting concern consumed by every protected RPC
 * endpoint. The import into auth's domain port is the price of the
 * bridge — declared as a named arch test exception alongside
 * SessionResolverAdapter.
 */
export class AuthenticationAdapter implements Authentication {
  constructor(private readonly sessions: Sessions) {}

  check(sessionId: string): AuthenticatedSession {
    const session = this.sessions.get(sessionId);
    return {
      sessionId: session.id.value,
      key: session.key.value,
      expiresAt: session.expiresAt.at.date,
    };
  }
}
