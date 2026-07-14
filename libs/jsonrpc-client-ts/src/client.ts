import type { Call } from "@jsonrpc-client-ts/call.ts";
import type { Channel } from "@jsonrpc-client-ts/channel.ts";
import type { Notification } from "@jsonrpc-client-ts/envelope/notification.ts";
import type { Request } from "@jsonrpc-client-ts/envelope/request.ts";
import type { Response } from "@jsonrpc-client-ts/envelope/response/response.ts";
import { Exception } from "@jsonrpc-client-ts/exception.ts";

/**
 * Low-level JSON-RPC client. Issues an id-correlated call (`invoke`) and
 * exposes a method-keyed notification subscription (`onNotification`).
 * Either returns the typed response or throws Exception with the JSON-RPC
 * error code.
 *
 * Accepts a full `Channel` (recommended) or a bare `Call` function (back
 * compat — no notifications). BC-specific integrations (e.g.
 * AuthIntegration) wrap this with the codegen'd Request/Response types.
 */
export class Client {
  private nextId = 0;
  private readonly handlers = new Map<string, Set<(params: unknown) => void>>();
  private readonly channel: Channel;

  constructor(channelOrCall: Channel | Call) {
    this.channel = typeof channelOrCall === "function"
      ? functionAsChannel(channelOrCall)
      : channelOrCall;
    this.channel.onNotification((n) => this.dispatchNotification(n));
  }

  async invoke<R>(method: string, request: unknown): Promise<R> {
    const envelope = await this.channel.send({
      jsonrpc: "2.0",
      id: ++this.nextId,
      method,
      params: request,
    });

    if ("error" in envelope) throw Exception.from(envelope);
    return envelope.result as R;
  }

  /**
   * Subscribe to notifications for a specific method.
   * Returns an unsubscribe function.
   */
  onNotification<P>(method: string, handler: (params: P) => void): () => void {
    const set = this.handlers.get(method) ?? new Set();
    const typed = handler as (p: unknown) => void;
    set.add(typed);
    this.handlers.set(method, set);
    return () => set.delete(typed);
  }

  private dispatchNotification(notification: Notification): void {
    const set = this.handlers.get(notification.method);
    if (!set) return;
    for (const h of set) h(notification.params);
  }
}

/**
 * Bridge a bare Call function (legacy API) to the Channel interface.
 * Notifications are dropped — only id-correlated responses flow.
 */
function functionAsChannel(call: (request: Request) => Promise<Response>): Channel {
  return {
    send: call,
    onNotification: () => () => {},
  };
}
