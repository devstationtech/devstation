import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { DestroyNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/destroy-nodes-handler.ts";
import { DestroyNodes } from "@server/cluster/application/commands/proxmox/provisioning/destroy-nodes.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

/**
 * MCP endpoint `devstation_cluster_provisioning_destroy` — destructive.
 * Returns `{ executionId }` immediately. Enforces
 * `policy.requireMutableCluster` on the resolved cluster name before
 * dispatch (never trust a raw id; read first).
 */
export class DestroyNodesMcpEndpoint implements
  Endpoint<
    "devstation_cluster_provisioning_destroy",
    { clusterId: string; nodeIds: string[] },
    { executionId: string }
  > {
  readonly name = "devstation_cluster_provisioning_destroy" as const;
  readonly title = "Provisioning destroy";
  readonly description =
    "Provisioning destroy — resolves the cluster name; if a policy is set, enforces it first.";
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
    private readonly handler: DestroyNodesHandler,
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
      new DestroyNodes(args.clusterId, [...args.nodeIds]),
    );
    return { executionId: execution.id };
  }
}
