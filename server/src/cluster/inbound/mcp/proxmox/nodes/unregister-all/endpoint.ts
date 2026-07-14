import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UnregisterAllNodesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-nodes-handler.ts";
import { UnregisterAllNodes } from "@server/cluster/application/commands/proxmox/unregister-all-nodes.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
};

/**
 * MCP endpoint `devstation_cluster_nodes_unregister_all` — drops every
 * node from a Proxmox cluster. MCP-port counterpart of
 * `cluster.proxmox.nodes.unregisterAll`; consumes the same handler.
 *
 * Destructive; policy enforced via the resolved cluster name. Rejects if
 * any node still has VMs attached.
 */
export class UnregisterAllNodesMcpEndpoint
  implements Endpoint<"devstation_cluster_nodes_unregister_all", Args, Record<string, never>> {
  readonly name = "devstation_cluster_nodes_unregister_all" as const;
  readonly title = "Unregister all Proxmox nodes";
  readonly description = "Drops every node from a Proxmox cluster in one operation. Rejects if " +
    "any node still has VMs attached. Policy enforced via the resolved cluster name.";
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
    private readonly handler: UnregisterAllNodesHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(new UnregisterAllNodes(args.clusterId));
    return {};
  }
}
