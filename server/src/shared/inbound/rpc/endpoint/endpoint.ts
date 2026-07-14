import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";

/**
 * An Endpoint exposes a single RPC method to clients.
 *
 * Each BC declares its own endpoints (one class per method): the BC owns
 * the method-name literal, the typed Request/Response (sourced from its
 * OpenRPC document via codegen), and the dispatch glue that builds a
 * Command and calls the application Handler.
 *
 * Each inbound port (RPC today, HTTP tomorrow) carries its own
 * Request/Response shape — the names are port-level concepts, scoped by
 * the port's folder. No naming collision.
 *
 * Streaming endpoints receive a `DispatchContext` to push notifications
 * during dispatch; non-streaming endpoints just ignore the parameter.
 */
export interface Endpoint<M extends string, Request, Response> {
  readonly method: M;
  /**
   * Long-lived read-only pump (e.g. `execution.watch`): its dispatch
   * stays pending while it streams notifications. The serial serve loop
   * dispatches these concurrently so they never block other requests.
   * MUST NOT mutate persisted aggregates — the no-concurrent-mutation
   * invariant is preserved by keeping mutating endpoints serial.
   */
  readonly streaming?: boolean;
  dispatch(request: Request, ctx?: DispatchContext): Promise<Response> | Response;
}
