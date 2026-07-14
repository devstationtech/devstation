import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { CreateImageHandler } from "@server/cluster/application/handlers/proxmox/create-image-handler.ts";
import { CreateImage } from "@server/cluster/application/commands/proxmox/create-image.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

/**
 * MCP endpoint `devstation_cluster_image_create` — long-running. The
 * RPC counterpart is streaming (`ctx.notify` per event); the MCP path
 * returns `{ executionId }` immediately and lets the agent attach via
 * `devstation_execution_watch` to drain the event stream until terminal.
 *
 * Mutating; policy enforced via resolved cluster name.
 */
export class CreateImageMcpEndpoint implements
  Endpoint<
    "devstation_cluster_image_create",
    { clusterId: string; nodeId: string; imageId: string },
    { executionId: string }
  > {
  readonly name = "devstation_cluster_image_create" as const;
  readonly title = "Create image (SSH materialize)";
  readonly description = "Materializes an image on a node — policy enforced via cluster name; " +
    "returns executionId; watch with `devstation_execution_watch`.";
  readonly risk = "long-running" as const;
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
    private readonly handler: CreateImageHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(
    args: { clusterId: string; nodeId: string; imageId: string },
    ctx: DispatchContext,
  ): Promise<{ executionId: string }> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    const execution = await this.handler.handle(
      new CreateImage(args.clusterId, args.nodeId, args.imageId),
    );
    return { executionId: execution.id };
  }
}
