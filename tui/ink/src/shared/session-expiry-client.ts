import { Client } from "@jsonrpc-client-ts/client.ts";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import { SESSION_EXPIRED, sessionExpired } from "@ui/shared/session-expired.ts";

/**
 * RPC `Client` with a central session-expiry interceptor.
 *
 * Any `invoke` that fails with an Unauthenticated wire error (session
 * unknown/expired) emits the global `SESSION_EXPIRED` event before
 * rethrowing, so `AuthGate` can bounce the user back to login from
 * anywhere — not only the renew loop. UI-only concern: the core just
 * returns the JSON-RPC error code; this class maps it to a UI signal.
 */
export class SessionExpiryClient extends Client {
  override async invoke<R>(method: string, request: unknown): Promise<R> {
    try {
      return await super.invoke<R>(method, request);
    } catch (error) {
      if (error instanceof Exception && error.isUnauthenticated()) {
        sessionExpired.dispatchEvent(new Event(SESSION_EXPIRED));
      }
      throw error;
    }
  }
}
