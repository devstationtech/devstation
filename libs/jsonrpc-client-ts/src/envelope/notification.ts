/**
 * JSON-RPC 2.0 notification envelope (client-side mirror).
 *
 * A notification is a Request without an `id` member — the server emits
 * it; the client receives it but does NOT respond. Used for
 * server-initiated push events on the same wire as id-correlated
 * request/response.
 */
export interface Notification<M extends string = string, P = unknown> {
  readonly jsonrpc: "2.0";
  readonly method: M;
  readonly params: P;
}
