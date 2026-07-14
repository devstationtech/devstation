import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { ClusterListRequest, ClusterListResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as AllClustersQuery } from "@server/cluster/application/queries/all/query.ts";

/**
 * Endpoint `cluster.list` — every cluster with a topology summary.
 *
 * Thin inbound adapter: delegates to the existing `AllClustersQuery` and
 * relays the records as-is (the query's shape already matches
 * `ClusterRecord` from the generated contracts).
 */
export class ListClustersEndpoint implements
  ProtectedEndpoint<
    "cluster.list",
    ClusterListRequest,
    ClusterListResponse
  > {
  readonly method = "cluster.list" as const;

  constructor(private readonly query: AllClustersQuery) {}

  async dispatch(_request: ClusterListRequest): Promise<ClusterListResponse> {
    return await this.query.execute();
  }
}
