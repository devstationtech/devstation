import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { ClusterByIdRequest, ClusterByIdResponse } from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";

/**
 * Endpoint `cluster.byId` — returns the summary for a single cluster.
 *
 * The underlying query returns `null` when the id is missing; here we
 * throw so the RPC surface surfaces a clean error to the client (mirrors
 * `unregister`'s behavior).
 */
export class ClusterByIdEndpoint implements
  ProtectedEndpoint<
    "cluster.byId",
    ClusterByIdRequest,
    ClusterByIdResponse
  > {
  readonly method = "cluster.byId" as const;

  constructor(private readonly query: ClusterByIdQuery) {}

  async dispatch(request: ClusterByIdRequest): Promise<ClusterByIdResponse> {
    const record = await this.query.execute(request.id);
    if (!record) throw new Error(`cluster '${request.id}' not found.`);
    return record;
  }
}
