import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ExecutionCancelRequest,
  ExecutionCancelResponse,
  ExecutionEvent,
  ExecutionEventNotification,
  ExecutionListRequest,
  ExecutionListResponse,
  ExecutionWatchRequest,
  ExecutionWatchResponse,
} from "@jsonrpc-contracts-ts/executions.gen.ts";

/**
 * UI integration for the `operation.*` RPC surface.
 *
 * `watch(...)` is the streaming entry point: returns an `AsyncIterable`
 * the UI can `for-await-of`, hiding the underlying notification
 * subscription + invoke promise. Discriminate events with
 * `switch (event.type)` — no `instanceof` on domain classes.
 *
 * `cancel(...)` is best-effort (AIP-151). `list(...)` returns a snapshot
 * for observability screens.
 */
export class ExecutionsIntegration {
  constructor(private readonly rpc: Client) {}

  watch(request: ExecutionWatchRequest): AsyncIterable<ExecutionEvent> {
    const rpc = this.rpc;
    const buffer: ExecutionEvent[] = [];
    let waiting = Promise.withResolvers<void>();
    let done = false;
    let invokeError: Error | null = null;

    const unsubscribe = rpc.onNotification<ExecutionEventNotification>(
      "execution.event",
      (params) => {
        if (params.executionId !== request.executionId) return;
        buffer.push(params.event);
        const previous = waiting;
        waiting = Promise.withResolvers<void>();
        previous.resolve();
      },
    );

    void rpc.invoke<ExecutionWatchResponse>("execution.watch", request)
      .catch((error: Error) => {
        invokeError = error;
      })
      .finally(() => {
        done = true;
        const previous = waiting;
        waiting = Promise.withResolvers<void>();
        previous.resolve();
        unsubscribe();
      });

    return (async function* () {
      let cursor = 0;
      while (true) {
        while (cursor < buffer.length) {
          yield buffer[cursor++];
        }
        if (done) {
          if (invokeError) throw invokeError;
          return;
        }
        await waiting.promise;
      }
    })();
  }

  cancel(request: ExecutionCancelRequest): Promise<ExecutionCancelResponse> {
    return this.rpc.invoke<ExecutionCancelResponse>("execution.cancel", request);
  }

  list(request: ExecutionListRequest): Promise<ExecutionListResponse> {
    return this.rpc.invoke<ExecutionListResponse>("execution.list", request);
  }
}
