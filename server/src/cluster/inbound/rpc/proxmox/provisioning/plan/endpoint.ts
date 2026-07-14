import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxProvisioningPlanRequest,
  ClusterProxmoxProvisioningPlanResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { PlanNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/plan-nodes-handler.ts";
import { PlanNodes } from "@server/cluster/application/commands/proxmox/provisioning/plan-nodes.ts";

/**
 * Endpoint `cluster.proxmox.provisioning.plan` — fire-and-return.
 *
 * Hands the command to `PlanNodesHandler`, which starts an Execution and
 * returns the read handle. The endpoint acknowledges with `{ executionId }`;
 * the UI attaches via `operation.watch(executionId)` to receive
 * `operation.event` notifications (Log/Step/Succeeded/Failed/
 * Cancelled). Cancellation goes through `operation.cancel(executionId)`.
 */
export class PlanEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.provisioning.plan",
    ClusterProxmoxProvisioningPlanRequest,
    ClusterProxmoxProvisioningPlanResponse
  > {
  readonly method = "cluster.proxmox.provisioning.plan" as const;

  constructor(private readonly handler: PlanNodesHandler) {}

  async dispatch(
    request: ClusterProxmoxProvisioningPlanRequest,
  ): Promise<ClusterProxmoxProvisioningPlanResponse> {
    const execution = await this.handler.handle(
      new PlanNodes(request.clusterId, [...request.nodeIds]),
    );
    return { executionId: execution.id };
  }
}
