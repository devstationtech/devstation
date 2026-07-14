/**
 * Context handed to an endpoint during dispatch, so it can push
 * server-initiated notifications back to the client on the same wire.
 *
 * The default Server creates a context that forwards `notify(...)` calls
 * to the transport as JSON-RPC notifications (no `id`). Endpoints that
 * don't need to push notifications simply ignore the parameter — it is
 * optional on every dispatch signature.
 *
 * Used by streaming endpoints (e.g. `operation.watch`) to emit progress
 * events during a long-running request.
 */
export interface DispatchContext {
  notify<P>(method: string, params: P): Promise<void>;
}
