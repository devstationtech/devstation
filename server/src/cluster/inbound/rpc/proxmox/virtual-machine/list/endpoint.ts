import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxVirtualMachineListRequest,
  ClusterProxmoxVirtualMachineListResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as AllVirtualMachinesQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/all/query.ts";

/**
 * Endpoint `cluster.proxmox.virtualMachine.list` — VM rows on a node, enriched with
 * role/size/environment/image names and optional live resources.
 * Never throws.
 */
export class ListProxmoxVirtualMachinesEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.virtualMachine.list",
    ClusterProxmoxVirtualMachineListRequest,
    ClusterProxmoxVirtualMachineListResponse
  > {
  readonly method = "cluster.proxmox.virtualMachine.list" as const;

  constructor(private readonly query: AllVirtualMachinesQuery) {}

  async dispatch(
    request: ClusterProxmoxVirtualMachineListRequest,
  ): Promise<ClusterProxmoxVirtualMachineListResponse> {
    return await this.query.execute(request.clusterId, request.nodeId);
  }
}
