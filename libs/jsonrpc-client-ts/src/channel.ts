import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";

/**
 * Bidirectional connection to a JSON-RPC 2.0 server.
 *
 * `send(request)` issues a single id-correlated call and resolves with
 * the matching Response. `onNotification(handler)` registers a callback
 * invoked for every server-initiated frame that has no `id` (a JSON-RPC
 * notification). Both flow on the same logical channel.
 *
 * Transport primitives implement this interface (subprocess stdio,
 * future WebSocket, etc.). The Client wraps a Channel and exposes the
 * typed API (`invoke`, method-keyed notification subscriptions).
 */
export interface Channel {
  send(request: Request): Promise<Response>;
  onNotification(handler: (notification: Notification) => void): () => void;
}
