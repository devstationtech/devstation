import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UnassignImageHandler } from "@server/cluster/application/handlers/proxmox/unassign-image-handler.ts";
import { UnassignImage } from "@server/cluster/application/commands/proxmox/unassign-image.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  nodeId: string;
  imageId: string;
};

/**
 * MCP endpoint `devstation_cluster_image_unassign` — removes an image
 * association from a node. Rejects if the image is still referenced by
 * any VM on that node. Destructive; policy enforced via the resolved
 * cluster name.
 */
export class UnassignImageMcpEndpoint
  implements Endpoint<"devstation_cluster_image_unassign", Args, Record<string, never>> {
  readonly name = "devstation_cluster_image_unassign" as const;
  readonly title = "Unassign Image";
  readonly description =
    "Removes an image association from a Proxmox node. Rejects if the image is still referenced by any VM on that node. Policy enforced via the resolved cluster name.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
      imageId: { type: "string" },
    },
    required: ["clusterId", "nodeId", "imageId"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UnassignImageHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new UnassignImage(args.clusterId, args.nodeId, args.imageId),
    );
    return {};
  }
}
