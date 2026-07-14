import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxImagesAssignRequest,
  ClusterProxmoxImagesAssignResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { AssignImageHandler } from "@server/cluster/application/handlers/proxmox/assign-image-handler.ts";
import { AssignImage } from "@server/cluster/application/commands/proxmox/assign-image.ts";

/**
 * Endpoint `cluster.proxmox.images.assign` — associates a catalog image
 * to a node + reserved virtualMachineId + storage slot.
 */
export class AssignImageEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.images.assign",
    ClusterProxmoxImagesAssignRequest,
    ClusterProxmoxImagesAssignResponse
  > {
  readonly method = "cluster.proxmox.images.assign" as const;

  constructor(private readonly handler: AssignImageHandler) {}

  async dispatch(
    request: ClusterProxmoxImagesAssignRequest,
  ): Promise<ClusterProxmoxImagesAssignResponse> {
    await this.handler.handle(
      new AssignImage(
        request.clusterId,
        request.nodeId,
        request.imageId,
        request.virtualMachineId,
        request.storage,
        request.name,
        request.os,
        request.sourceUrl,
      ),
    );
    return {};
  }
}
