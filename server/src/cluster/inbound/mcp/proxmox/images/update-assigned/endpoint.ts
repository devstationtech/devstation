import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UpdateAssignedImageHandler } from "@server/cluster/application/handlers/proxmox/update-assigned-image-handler.ts";
import { UpdateAssignedImage } from "@server/cluster/application/commands/proxmox/update-assigned-image.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  nodeId: string;
  imageId: string;
  virtualMachineId: number;
  storage: string;
};

/**
 * MCP endpoint `devstation_cluster_image_update_assigned` — replaces the
 * virtualMachineId and storage slot of an existing image assignment on a node.
 * Mutating; policy enforced via the resolved cluster name.
 */
export class UpdateAssignedImageMcpEndpoint
  implements Endpoint<"devstation_cluster_image_update_assigned", Args, Record<string, never>> {
  readonly name = "devstation_cluster_image_update_assigned" as const;
  readonly title = "Update Assigned Image";
  readonly description =
    "Replaces the virtualMachineId and storage slot of an existing image assignment on a Proxmox node. Policy enforced via the resolved cluster name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
      imageId: { type: "string" },
      virtualMachineId: { type: "number" },
      storage: { type: "string" },
    },
    required: ["clusterId", "nodeId", "imageId", "virtualMachineId", "storage"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UpdateAssignedImageHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new UpdateAssignedImage(
        args.clusterId,
        args.nodeId,
        args.imageId,
        args.virtualMachineId,
        args.storage,
      ),
    );
    return {};
  }
}
