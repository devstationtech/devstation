import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { PlanNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/plan-nodes-handler.ts";
import { PlanNodes } from "@server/cluster/application/commands/proxmox/provisioning/plan-nodes.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

/**
 * MCP endpoint `devstation_cluster_provisioning_plan` — returns
 * `{ executionId }` immediately; the agent attaches via
 * `devstation_execution_watch` to consume the event stream until terminal.
 *
 * Plan does not touch infrastructure, but it DOES persist node FSM
 * transitions (PLAN_STARTED → PLAN_SUCCEEDED/FAILED) — and an interrupted
 * run can leave a node mid-state, blocking other operations. So it is
 * policy-guarded exactly like apply/destroy (`requireMutableCluster` on the
 * resolved cluster name — never trust a raw id; read first, then guard).
 */
export class PlanNodesMcpEndpoint implements
  Endpoint<
    "devstation_cluster_provisioning_plan",
    { clusterId: string; nodeIds: string[] },
    { executionId: string }
  > {
  readonly name = "devstation_cluster_provisioning_plan" as const;
  readonly title = "Provisioning plan";
  readonly description =
    "Provisioning plan — no infrastructure changes, but node provisioning state " +
    "is persisted; if a policy is set, it is enforced first.";
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
    private readonly handler: PlanNodesHandler,
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
      new PlanNodes(args.clusterId, [...args.nodeIds]),
    );
    return { executionId: execution.id };
  }
}
