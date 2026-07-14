import type { AuthenticatedSession } from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";

/**
 * An Endpoint that requires an authenticated session.
 *
 * Receives the AuthenticatedSession as the second dispatch argument —
 * the type system enforces that you cannot call `dispatch` without one.
 * The EndpointRegistry.protected() method handles wrapping with the
 * Authenticated decorator at registration time, so each ProtectedEndpoint
 * stays focused on its domain logic with NO Authentication dependency
 * in its constructor.
 *
 * Streaming protected endpoints (e.g. `operation.watch`) optionally
 * receive a `DispatchContext` as the third parameter to push
 * notifications during the request lifetime.
 */
export interface ProtectedEndpoint<
  M extends string,
  Request extends { sessionId: string },
  Response,
> {
  readonly method: M;
  /** See `Endpoint.streaming` — long-lived read-only pump. */
  readonly streaming?: boolean;
  dispatch(
    request: Request,
    session: AuthenticatedSession,
    ctx?: DispatchContext,
  ): Promise<Response> | Response;
}
