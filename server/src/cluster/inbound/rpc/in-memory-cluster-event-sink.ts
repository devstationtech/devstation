import type { ClusterEvent } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import { ClusterEventNotification } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";
import type {
  ClusterEventSink,
  ClusterEventSubscriptions,
} from "@server/cluster/inbound/rpc/cluster-event-sink.ts";

/**
 * Process-local fan-out from the bus→UI seam.
 *
 * `cluster.subscribe` registers one `DispatchContext` per watching
 * client under a clusterId; `ClusterEventPublisher` calls `emit` when a
 * cluster domain event is translated to its `*V1`. `emit` forwards the `*V1`
 * (concrete — serialized to JSON only by the transport) as a
 * `cluster.event` notification to every ctx registered for that cluster.
 *
 * Lifetime: a registered ctx is valid for the stdio connection's life
 * (single UI subprocess). No disconnect detection yet — `register`
 * returns an unsubscribe thunk for when that signal is wired.
 */
export class InMemoryClusterEventSink implements ClusterEventSink, ClusterEventSubscriptions {
  private readonly byCluster = new Map<string, Set<DispatchContext>>();

  register(clusterId: string, ctx: DispatchContext): () => void {
    let set = this.byCluster.get(clusterId);
    if (!set) {
      set = new Set();
      this.byCluster.set(clusterId, set);
    }
    set.add(ctx);
    return () => {
      const current = this.byCluster.get(clusterId);
      if (!current) return;
      current.delete(ctx);
      if (current.size === 0) this.byCluster.delete(clusterId);
    };
  }

  async emit(clusterId: string, event: ClusterEvent): Promise<void> {
    const set = this.byCluster.get(clusterId);
    if (!set || set.size === 0) return;
    const params = new ClusterEventNotification(clusterId, event);
    for (const ctx of set) {
      await ctx.notify<ClusterEventNotification>("cluster.event", params);
    }
  }
}
