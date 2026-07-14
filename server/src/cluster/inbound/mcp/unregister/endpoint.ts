import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UnregisterClusterHandler } from "@server/cluster/application/handlers/proxmox/unregister-cluster-handler.ts";
import { UnregisterCluster } from "@server/cluster/application/commands/proxmox/unregister-cluster.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

// Argument is `clusterId` for consistency with every other cluster MCP tool.
type Args = {
  clusterId: string;
};

/**
 * MCP endpoint `devstation_cluster_unregister` — removes a cluster from
 * the catalog. MCP-port counterpart of `cluster.unregister`; consumes
 * the same handler.
 *
 * Destructive; policy enforced via the resolved cluster name.
 */
export class UnregisterClusterMcpEndpoint
  implements Endpoint<"devstation_cluster_unregister", Args, Record<string, never>> {
  readonly name = "devstation_cluster_unregister" as const;
  readonly title = "Unregister cluster";
  readonly description = "Removes a cluster from the catalog. Destructive — all cluster " +
    "topology (nodes, images, VMs) is deleted. Policy enforced via the " +
    "resolved cluster name.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
    },
    required: ["clusterId"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UnregisterClusterHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(new UnregisterCluster(args.clusterId));
    return {};
  }
}
