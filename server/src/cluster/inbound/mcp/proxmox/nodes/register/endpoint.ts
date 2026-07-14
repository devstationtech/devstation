import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { RegisterNodeHandler } from "@server/cluster/application/handlers/proxmox/register-node-handler.ts";
import { RegisterNode } from "@server/cluster/application/commands/proxmox/register-node.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  name: string;
  ip: string;
  vaultId: string;
  usernameSecretId: string;
  passwordSecretId: string;
};

/**
 * MCP endpoint `devstation_cluster_node_register` — adds a node to a
 * Proxmox cluster (node id generated server-side). MCP-port counterpart
 * of `cluster.proxmox.nodes.register`; consumes the same handler.
 *
 * Mutating; policy enforced via the resolved cluster name.
 */
export class RegisterNodeMcpEndpoint
  implements Endpoint<"devstation_cluster_node_register", Args, Record<string, never>> {
  readonly name = "devstation_cluster_node_register" as const;
  readonly title = "Register Proxmox node";
  readonly description = "Adds a node to a Proxmox cluster — the node id is generated " +
    "server-side. The credential bundle (vault + username/password " +
    "secret ids) must already exist in the vault. Policy enforced via " +
    "the resolved cluster name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      name: { type: "string" },
      ip: { type: "string" },
      vaultId: { type: "string" },
      usernameSecretId: { type: "string" },
      passwordSecretId: { type: "string" },
    },
    required: ["clusterId", "name", "ip", "vaultId", "usernameSecretId", "passwordSecretId"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: RegisterNodeHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new RegisterNode(
        args.clusterId,
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
