import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxImagesUnassignRequest,
  ClusterProxmoxImagesUnassignResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { UnassignImageHandler } from "@server/cluster/application/handlers/proxmox/unassign-image-handler.ts";
import { UnassignImage } from "@server/cluster/application/commands/proxmox/unassign-image.ts";

/**
 * Endpoint `cluster.proxmox.images.unassign` — removes an image
 * association from a node. Rejects if the image is still referenced
 * by any VM on that node.
 */
export class UnassignImageEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.images.unassign",
    ClusterProxmoxImagesUnassignRequest,
    ClusterProxmoxImagesUnassignResponse
  > {
  readonly method = "cluster.proxmox.images.unassign" as const;

  constructor(private readonly handler: UnassignImageHandler) {}

  async dispatch(
    request: ClusterProxmoxImagesUnassignRequest,
  ): Promise<ClusterProxmoxImagesUnassignResponse> {
    await this.handler.handle(
      new UnassignImage(request.clusterId, request.nodeId, request.imageId),
    );
    return {};
  }
}
