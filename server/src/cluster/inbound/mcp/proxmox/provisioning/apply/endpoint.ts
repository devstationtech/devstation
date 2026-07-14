import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { ApplyNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/apply-nodes-handler.ts";
import { ApplyNodes } from "@server/cluster/application/commands/proxmox/provisioning/apply-nodes.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

/**
 * MCP endpoint `devstation_cluster_provisioning_apply` — mutating. Returns
 * `{ executionId }` immediately. Enforces `policy.requireMutableCluster`
 * on the resolved cluster name (never trust a raw id; read first then guard).
 */
export class ApplyNodesMcpEndpoint implements
  Endpoint<
    "devstation_cluster_provisioning_apply",
    { clusterId: string; nodeIds: string[] },
    { executionId: string }
  > {
  readonly name = "devstation_cluster_provisioning_apply" as const;
  readonly title = "Provisioning apply";
  readonly description =
    "Provisioning apply — resolves the cluster name; if a policy is set, enforces it first.";
  readonly risk = "long-running" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeIds: { type: "array", items: { type: "string" } },
    },
    required: ["clusterId", "nodeIds"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: ApplyNodesHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(
    args: { clusterId: string; nodeIds: string[] },
    ctx: DispatchContext,
  ): Promise<{ executionId: string }> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    const execution = await this.handler.handle(
      new ApplyNodes(args.clusterId, [...args.nodeIds]),
    );
    return { executionId: execution.id };
  }
}
