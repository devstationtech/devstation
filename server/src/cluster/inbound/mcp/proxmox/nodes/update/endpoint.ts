import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UpdateNodeHandler } from "@server/cluster/application/handlers/proxmox/update-node-handler.ts";
import { UpdateNode } from "@server/cluster/application/commands/proxmox/update-node.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  nodeId: string;
  name: string;
  ip: string;
  vaultId: string;
  usernameSecretId: string;
  passwordSecretId: string;
};

/**
 * MCP endpoint `devstation_cluster_node_update` — replaces the mutable
 * fields of an existing Proxmox node (name, ip, credential). MCP-port
 * counterpart of `cluster.proxmox.nodes.update`; consumes the same
 * handler.
 *
 * Mutating; policy enforced via the resolved cluster name.
 */
export class UpdateNodeMcpEndpoint
  implements Endpoint<"devstation_cluster_node_update", Args, Record<string, never>> {
  readonly name = "devstation_cluster_node_update" as const;
  readonly title = "Update Proxmox node";
  readonly description = "Replaces the mutable fields (name, IP, credential) of an existing " +
    "Proxmox node. Images and VMs are preserved. Policy enforced via the " +
    "resolved cluster name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
      name: { type: "string" },
      ip: { type: "string" },
      vaultId: { type: "string" },
      usernameSecretId: { type: "string" },
      passwordSecretId: { type: "string" },
    },
    required: [
      "clusterId",
      "nodeId",
      "name",
      "ip",
      "vaultId",
      "usernameSecretId",
      "passwordSecretId",
    ],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UpdateNodeHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new UpdateNode(
        args.clusterId,
        args.nodeId,
        args.name,
        args.ip,
        args.vaultId,
        args.usernameSecretId,
        args.passwordSecretId,
      ),
    );
    return {};
  }
}
