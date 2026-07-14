import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { DisconnectClusterHandler } from "@server/cluster/application/handlers/proxmox/disconnect-cluster-handler.ts";
import { DisconnectCluster } from "@server/cluster/application/commands/proxmox/disconnect-cluster.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
};

/**
 * MCP endpoint `devstation_cluster_disconnect` — clears the Proxmox
 * connection bound to a cluster. MCP-port counterpart of
 * `cluster.proxmox.disconnect`; consumes the same handler.
 *
 * Mutating; policy enforced via the resolved cluster name.
 */
export class DisconnectClusterMcpEndpoint
  implements Endpoint<"devstation_cluster_disconnect", Args, Record<string, never>> {
  readonly name = "devstation_cluster_disconnect" as const;
  readonly title = "Disconnect Proxmox cluster";
  readonly description = "Clears the Proxmox connection (host + credential) bound to a cluster. " +
    "Policy enforced via the resolved cluster name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
    },
    required: ["clusterId"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: DisconnectClusterHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(new DisconnectCluster(args.clusterId));
    return {};
  }
}
