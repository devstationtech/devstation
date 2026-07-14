import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UnregisterNodeHandler } from "@server/cluster/application/handlers/proxmox/unregister-node-handler.ts";
import { UnregisterNode } from "@server/cluster/application/commands/proxmox/unregister-node.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  nodeId: string;
};

/**
 * MCP endpoint `devstation_cluster_node_unregister` — removes a Proxmox
 * node from its cluster. MCP-port counterpart of
 * `cluster.proxmox.nodes.unregister`; consumes the same handler.
 *
 * Destructive; policy enforced via the resolved cluster name. Rejects if
 * the node still has virtual-machines.
 */
export class UnregisterNodeMcpEndpoint
  implements Endpoint<"devstation_cluster_node_unregister", Args, Record<string, never>> {
  readonly name = "devstation_cluster_node_unregister" as const;
  readonly title = "Unregister Proxmox node";
  readonly description = "Removes a Proxmox node from its cluster. Rejects if the node still " +
    "has virtual-machines attached. Policy enforced via the resolved cluster name.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
    },
    required: ["clusterId", "nodeId"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UnregisterNodeHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(new UnregisterNode(args.clusterId, args.nodeId));
    return {};
  }
}
