import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxStorageByNodeRequest,
  ClusterProxmoxStorageByNodeResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as StoragesByNodeQuery } from "@server/cluster/application/queries/proxmox/storage/by-node/query.ts";

/**
 * Endpoint `cluster.proxmox.storage.byNode` — live storages of a single
 * Proxmox node. Never throws: returns `{ connected: false, storages: [] }`
 * when the cluster/node/connection/API is unreachable.
 */
export class StorageByNodeEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.storage.byNode",
    ClusterProxmoxStorageByNodeRequest,
    ClusterProxmoxStorageByNodeResponse
  > {
  readonly method = "cluster.proxmox.storage.byNode" as const;

  constructor(private readonly query: StoragesByNodeQuery) {}

  async dispatch(
    request: ClusterProxmoxStorageByNodeRequest,
  ): Promise<ClusterProxmoxStorageByNodeResponse> {
    return await this.query.execute(request.clusterId, request.nodeId);
  }
}
