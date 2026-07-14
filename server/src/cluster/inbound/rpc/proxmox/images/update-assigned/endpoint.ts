import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxImagesUpdateAssignedRequest,
  ClusterProxmoxImagesUpdateAssignedResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { UpdateAssignedImageHandler } from "@server/cluster/application/handlers/proxmox/update-assigned-image-handler.ts";
import { UpdateAssignedImage } from "@server/cluster/application/commands/proxmox/update-assigned-image.ts";

/**
 * Endpoint `cluster.proxmox.images.updateAssigned` — replaces virtualMachineId and
 * storage slot of an existing image assignment on a node.
 */
export class UpdateAssignedImageEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.images.updateAssigned",
    ClusterProxmoxImagesUpdateAssignedRequest,
    ClusterProxmoxImagesUpdateAssignedResponse
  > {
  readonly method = "cluster.proxmox.images.updateAssigned" as const;

  constructor(private readonly handler: UpdateAssignedImageHandler) {}

  async dispatch(
    request: ClusterProxmoxImagesUpdateAssignedRequest,
  ): Promise<ClusterProxmoxImagesUpdateAssignedResponse> {
    await this.handler.handle(
      new UpdateAssignedImage(
        request.clusterId,
        request.nodeId,
        request.imageId,
        request.virtualMachineId,
        request.storage,
      ),
    );
    return {};
  }
}
