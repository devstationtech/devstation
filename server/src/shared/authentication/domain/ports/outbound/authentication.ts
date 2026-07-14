/**
 * Authentication port — validates session identifiers and exposes the
 * authenticated session context.
 *
 * Distinct from the legacy `SessionResolver` (which returns "the active
 * session's key" with no explicit identifier): `Authentication` always
 * takes an explicit sessionId, suitable for the RPC boundary where the
 * client carries the identifier on the wire.
 *
 * `SessionResolver` stays in place as an internal bridge for in-process
 * services (station/cluster provisioning secrets) that don't have a wire
 * sessionId.
 */
export interface Authentication {
  /** Validates the sessionId. Throws Unauthenticated if invalid/expired. */
  check(sessionId: string): AuthenticatedSession;
}

export interface AuthenticatedSession {
  readonly sessionId: string;
  readonly key: string;
  readonly expiresAt: Date;
}
