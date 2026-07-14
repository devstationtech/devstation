import type { ClusterEvent } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";

/**
 * Delivers a bound `*V1` cluster event to whoever is currently watching
 * the cluster via `cluster.subscribe`.
 *
 * The sink is the seam between the in-process bus (where
 * `ClusterEventPublisher` receives domain events) and the RPC
 * notification transport (the `cluster.subscribe` endpoint registers a
 * `DispatchContext` per client). The publisher hands the sink a concrete
 * `*V1` instance — serialization to JSON happens later, at the stdio
 * boundary to the UI subprocess, not here.
 */
export interface ClusterEventSink {
  emit(clusterId: string, event: ClusterEvent): Promise<void>;
}

/**
 * Subscription side of the same seam, consumed by the `cluster.subscribe`
 * endpoint. `register` returns an unsubscribe thunk so the endpoint can
 * clean up once a disconnect signal is wired (today the ctx lives for the
 * stdio connection's lifetime — single UI subprocess).
 */
export interface ClusterEventSubscriptions {
  register(clusterId: string, ctx: DispatchContext): () => void;
}
