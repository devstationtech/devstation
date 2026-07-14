import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxNodesListRequest,
  ClusterProxmoxNodesListResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as AllNodesQuery } from "@server/cluster/application/queries/proxmox/node/all/query.ts";

/**
 * Endpoint `cluster.proxmox.nodes.list` — node rows for a cluster.
 * Merges static catalog info with live resource snapshots from the
 * Proxmox API when reachable. Never throws.
 */
export class ListProxmoxNodesEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.nodes.list",
    ClusterProxmoxNodesListRequest,
    ClusterProxmoxNodesListResponse
  > {
  readonly method = "cluster.proxmox.nodes.list" as const;

  constructor(private readonly query: AllNodesQuery) {}

  async dispatch(
    request: ClusterProxmoxNodesListRequest,
  ): Promise<ClusterProxmoxNodesListResponse> {
    return await this.query.execute(request.clusterId);
  }
}
