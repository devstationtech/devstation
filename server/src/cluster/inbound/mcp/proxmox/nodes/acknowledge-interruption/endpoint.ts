import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { AcknowledgeInterruptionHandler } from "@server/cluster/application/handlers/proxmox/acknowledge-interruption-handler.ts";
import { AcknowledgeInterruption } from "@server/cluster/application/commands/proxmox/acknowledge-interruption.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

/**
 * MCP endpoint `devstation_cluster_node_acknowledge_interruption` —
 * operator acknowledges a node interrupted in a transient FSM state
 * (PLAN_STARTED / APPLY_STARTED / DESTROY_STARTED) so retry / replan
 * / destroy become valid again.
 *
 * Mutating; policy enforced via resolved cluster name.
 */
export class AcknowledgeInterruptionMcpEndpoint implements
  Endpoint<
    "devstation_cluster_node_acknowledge_interruption",
    { clusterId: string; nodeId: string },
    Record<string, never>
  > {
  readonly name = "devstation_cluster_node_acknowledge_interruption" as const;
  readonly title = "Acknowledge node interruption";
  readonly description = "Operator acknowledges that a node in a transient FSM state " +
    "(PLAN_STARTED / APPLY_STARTED / DESTROY_STARTED) was interrupted — " +
    "demotes to the matching *_FAILED so retry/replan/destroy become valid. " +
    "Rejects when the node isn't in a transient state.";
  readonly risk = "mutating" as const;
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
    private readonly handler: AcknowledgeInterruptionHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(
    args: { clusterId: string; nodeId: string },
    ctx: DispatchContext,
  ): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new AcknowledgeInterruption(args.clusterId, args.nodeId),
    );
    return {};
  }
}
