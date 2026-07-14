import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  ClusterEvent,
  ClusterEventNotification,
  ClusterSubscribeRequest,
  ClusterSubscribeResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";

/**
 * UI integration for the `cluster.subscribe` / `cluster.event` surface.
 *
 * Unlike `ExecutionsIntegration.watch` (which ends when the operation
 * reaches a terminal), a cluster subscription is open-ended:
 * `cluster.subscribe` is register-and-return, so the invoke resolves
 * immediately with an Ack and `cluster.event` notifications keep
 * flowing for the cluster until the consumer stops iterating (the
 * generator's `finally` unsubscribes) or the subscribe call fails.
 *
 * Discriminate events with `switch (event.type)` — the `*V1` classes
 * are structural type contracts; the wire delivers plain JSON.
 */
export class ClusterEventIntegration {
  constructor(private readonly rpc: Client) {}

  watch(request: ClusterSubscribeRequest): AsyncIterable<ClusterEvent> {
    const rpc = this.rpc;
    const buffer: ClusterEvent[] = [];
    let waiting = Promise.withResolvers<void>();
    let invokeError: Error | null = null;

    const unsubscribe = rpc.onNotification<ClusterEventNotification>(
      "cluster.event",
      (params) => {
        if (params.clusterId !== request.clusterId) return;
        buffer.push(params.event);
        const previous = waiting;
        waiting = Promise.withResolvers<void>();
        previous.resolve();
      },
    );

    // The Ack only confirms registration — it does NOT end the stream.
    // Only a failed subscribe terminates it (surfaced to the consumer).
    void rpc.invoke<ClusterSubscribeResponse>("cluster.subscribe", request)
      .catch((error: Error) => {
        invokeError = error;
        const previous = waiting;
        waiting = Promise.withResolvers<void>();
        previous.resolve();
      });

    return (async function* () {
      try {
        let cursor = 0;
        while (true) {
          while (cursor < buffer.length) {
            yield buffer[cursor++];
          }
          if (invokeError) throw invokeError;
          await waiting.promise;
        }
      } finally {
        unsubscribe();
      }
    })();
  }
}
