import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxConnectionsListRequest,
  ClusterProxmoxConnectionsListResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as ProxmoxConnectionsAllQuery } from "@server/cluster/application/queries/proxmox/connection/all/query.ts";

/**
 * Endpoint `cluster.proxmox.connections.list` — the Proxmox connection
 * bound to the cluster (zero or one entry). Never throws — returns `[]`
 * when the cluster is missing or unconfigured.
 */
export class ListProxmoxConnectionsEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.connections.list",
    ClusterProxmoxConnectionsListRequest,
    ClusterProxmoxConnectionsListResponse
  > {
  readonly method = "cluster.proxmox.connections.list" as const;

  constructor(private readonly query: ProxmoxConnectionsAllQuery) {}

  async dispatch(
    request: ClusterProxmoxConnectionsListRequest,
  ): Promise<ClusterProxmoxConnectionsListResponse> {
    return await this.query.execute(request.clusterId);
  }
}
