import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProvidersListRequest,
  ClusterProvidersListResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as AllProvidersQuery } from "@server/cluster/application/queries/providers/all/query.ts";

/**
 * Endpoint `cluster.providers.list` — available cluster providers
 * Read; authoritative source for UI provider pickers.
 */
export class ListProvidersEndpoint implements
  ProtectedEndpoint<
    "cluster.providers.list",
    ClusterProvidersListRequest,
    ClusterProvidersListResponse
  > {
  readonly method = "cluster.providers.list" as const;

  constructor(private readonly query: AllProvidersQuery) {}

  dispatch(): Promise<ClusterProvidersListResponse> {
    return this.query.execute();
  }
}
