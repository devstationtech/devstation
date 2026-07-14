import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";
import type {
  ExecutionEventNotification,
  ExecutionWatchRequest,
  ExecutionWatchResponse,
} from "@jsonrpc-contracts-ts/executions.gen.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";

/**
 * Endpoint `operation.watch` — subscribes to an operation's event stream.
 *
 * The handler iterates the AsyncIterable yielded by the Execution and
 * pushes each event as an `execution.event` JSON-RPC notification (no
 * `id`). Events are codegen classes — already in wire shape — so they
 * are forwarded directly with no mapper. The final terminal event also
 * flows as a notification; the request's response is an empty Ack — it
 * just signals that the watcher iteration has finished.
 *
 * When `ctx` is absent (no caller wired notifications), the endpoint
 * still drains the stream but the events are silently dropped.
 */
export class WatchEndpoint
  implements ProtectedEndpoint<"execution.watch", ExecutionWatchRequest, ExecutionWatchResponse> {
  readonly method = "execution.watch" as const;
  // Stays pending while it pumps execution.event notifications until the
  // terminal — read-only, so the serve loop dispatches it concurrently.
  readonly streaming = true;

  constructor(private readonly executions: Executions) {}

  async dispatch(
    request: ExecutionWatchRequest,
    _session: unknown,
    ctx?: DispatchContext,
  ): Promise<ExecutionWatchResponse> {
    const operation = this.executions.of(request.executionId);
    for await (const event of operation.watch()) {
      if (!ctx) continue;
      const params: ExecutionEventNotification = {
        executionId: request.executionId,
        event,
      };
      await ctx.notify<ExecutionEventNotification>("execution.event", params);
    }
    return {};
  }
}
