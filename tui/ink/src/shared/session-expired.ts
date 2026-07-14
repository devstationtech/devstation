/**
 * UI-side session-expiry signal.
 *
 * Replaces the old in-process `authEvents`/`SESSION_EXPIRED` bus (which
 * the legacy Registry fired). With the UI fully on JSON-RPC there is no
 * in-process Registry to fire it; instead a thin interceptor on the RPC
 * `Client` (see `session-expiry-client.ts`) detects an Unauthenticated
 * wire error on ANY call and emits this event. `AuthGate` subscribes.
 *
 * Zero coupling with the core: the core only returns the standard
 * JSON-RPC error code; the UI decides how to react.
 */
export const sessionExpired = new EventTarget();
export const SESSION_EXPIRED = "session-expired";
