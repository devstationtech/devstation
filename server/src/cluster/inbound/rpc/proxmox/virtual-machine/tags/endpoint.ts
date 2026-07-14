import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxVirtualMachineTagsRequest,
  ClusterProxmoxVirtualMachineTagsResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as AllVirtualMachineTagsQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/tags/all/query.ts";

/**
 * Endpoint `cluster.proxmox.virtualMachine.tags` — distinct VM tags in use across
 * every cluster, with usage count, for reuse suggestions.
 * Never throws.
 */
export class ListVirtualMachineTagsEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.virtualMachine.tags",
    ClusterProxmoxVirtualMachineTagsRequest,
    ClusterProxmoxVirtualMachineTagsResponse
  > {
  readonly method = "cluster.proxmox.virtualMachine.tags" as const;

  constructor(private readonly query: AllVirtualMachineTagsQuery) {}

  async dispatch(
    _request: ClusterProxmoxVirtualMachineTagsRequest,
  ): Promise<ClusterProxmoxVirtualMachineTagsResponse> {
    return { tags: await this.query.execute() };
  }
}
