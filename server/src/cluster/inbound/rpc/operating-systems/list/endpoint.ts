import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterOperatingSystemsListRequest,
  ClusterOperatingSystemsListResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as AllOperatingSystemsQuery } from "@server/cluster/application/queries/operating-systems/all/query.ts";

/**
 * Endpoint `cluster.operatingSystems.list` — OS supported by cluster
 * images. Read; authoritative source for UI image-form OS
 * pickers.
 */
export class ListOperatingSystemsEndpoint implements
  ProtectedEndpoint<
    "cluster.operatingSystems.list",
    ClusterOperatingSystemsListRequest,
    ClusterOperatingSystemsListResponse
  > {
  readonly method = "cluster.operatingSystems.list" as const;

  constructor(private readonly query: AllOperatingSystemsQuery) {}

  dispatch(): Promise<ClusterOperatingSystemsListResponse> {
    return this.query.execute();
  }
}
