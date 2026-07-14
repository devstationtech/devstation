import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxVirtualMachineByImageRequest,
  ClusterProxmoxVirtualMachineByImageResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as VirtualMachineByImageQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/by-image/query.ts";

/**
 * Endpoint `cluster.proxmox.virtualMachine.byImage` — every VM currently associated
 * to the given image id, across clusters and nodes.
 *
 * Thin delegate to `VirtualMachineByImageQuery`. Returns an empty array when no
 * matches; never throws.
 */
export class VirtualMachineByImageEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.virtualMachine.byImage",
    ClusterProxmoxVirtualMachineByImageRequest,
    ClusterProxmoxVirtualMachineByImageResponse
  > {
  readonly method = "cluster.proxmox.virtualMachine.byImage" as const;

  constructor(private readonly query: VirtualMachineByImageQuery) {}

  async dispatch(
    request: ClusterProxmoxVirtualMachineByImageRequest,
  ): Promise<ClusterProxmoxVirtualMachineByImageResponse> {
    return await this.query.execute(request.imageId);
  }
}
