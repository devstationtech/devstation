import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";
import type {
  ClusterSubscribeRequest,
  ClusterSubscribeResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { ClusterEventSubscriptions } from "@server/cluster/inbound/rpc/cluster-event-sink.ts";

/**
 * Endpoint `cluster.subscribe` — register-and-return.
 *
 * Registers the caller's `DispatchContext` under the requested clusterId
 * so `ClusterEventPublisher` (via the sink) can push `cluster.event`
 * notifications as cluster domain events occur. Returns an empty Ack
 * immediately — unlike `execution.watch` (which stays pending until a
 * terminal event), a cluster subscription is open-ended: there is no
 * terminal, so blocking the request would hang it forever with no clean
 * end given the current transport (no per-request abort signal). The ctx
 * forwards to the persistent stdio connection, so notifications keep
 * flowing after the response until the UI subprocess exits.
 *
 * Known follow-up: no explicit `cluster.unsubscribe` / disconnect
 * cleanup yet — fine for the single-subprocess UI; revisit for
 * multi-client.
 */
export class SubscribeClusterEndpoint implements
  ProtectedEndpoint<
    "cluster.subscribe",
    ClusterSubscribeRequest,
    ClusterSubscribeResponse
  > {
  readonly method = "cluster.subscribe" as const;

  constructor(private readonly subscriptions: ClusterEventSubscriptions) {}

  dispatch(
    request: ClusterSubscribeRequest,
    _session: unknown,
    ctx?: DispatchContext,
  ): ClusterSubscribeResponse {
    if (ctx) this.subscriptions.register(request.clusterId, ctx);
    return {};
  }
}
