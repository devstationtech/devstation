import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { AssignImageHandler } from "@server/cluster/application/handlers/proxmox/assign-image-handler.ts";
import { AssignImage } from "@server/cluster/application/commands/proxmox/assign-image.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  nodeId: string;
  imageId: string;
  virtualMachineId: number;
  storage: string;
  name: string;
  os: string;
  sourceUrl: string;
};

/**
 * MCP endpoint `devstation_cluster_image_assign` — associates a catalog
 * image to a node + reserved virtualMachineId + storage slot. Mutating; policy
 * enforced via the resolved cluster name.
 */
export class AssignImageMcpEndpoint
  implements Endpoint<"devstation_cluster_image_assign", Args, Record<string, never>> {
  readonly name = "devstation_cluster_image_assign" as const;
  readonly title = "Assign Image";
  readonly description =
    "Associates a catalog image to a Proxmox node with a reserved virtualMachineId and storage slot. Policy enforced via the resolved cluster name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
      imageId: { type: "string" },
      virtualMachineId: { type: "number" },
      storage: { type: "string" },
      name: { type: "string" },
      os: { type: "string" },
      sourceUrl: { type: "string" },
    },
    required: [
      "clusterId",
      "nodeId",
      "imageId",
      "virtualMachineId",
      "storage",
      "name",
      "os",
      "sourceUrl",
    ],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: AssignImageHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new AssignImage(
        args.clusterId,
        args.nodeId,
        args.imageId,
        args.virtualMachineId,
        args.storage,
        args.name,
        args.os,
        args.sourceUrl,
      ),
    );
    return {};
  }
}
