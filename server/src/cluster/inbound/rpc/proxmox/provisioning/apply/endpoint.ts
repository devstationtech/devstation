import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxProvisioningApplyRequest,
  ClusterProxmoxProvisioningApplyResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { ApplyNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/apply-nodes-handler.ts";
import { ApplyNodes } from "@server/cluster/application/commands/proxmox/provisioning/apply-nodes.ts";

/**
 * Endpoint `cluster.proxmox.provisioning.apply` — fire-and-return.
 *
 * Hands the command to `ApplyNodesHandler`, which starts an Execution and
 * returns the read handle. The endpoint acknowledges with `{ executionId }`;
 * the UI attaches via `operation.watch(executionId)` to receive
 * `operation.event` notifications (Log/Step/Succeeded/Failed/
 * Cancelled). Cancellation goes through `operation.cancel(executionId)`.
 */
export class ApplyEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.provisioning.apply",
    ClusterProxmoxProvisioningApplyRequest,
    ClusterProxmoxProvisioningApplyResponse
  > {
  readonly method = "cluster.proxmox.provisioning.apply" as const;

  constructor(private readonly handler: ApplyNodesHandler) {}

  async dispatch(
    request: ClusterProxmoxProvisioningApplyRequest,
  ): Promise<ClusterProxmoxProvisioningApplyResponse> {
    const execution = await this.handler.handle(
      new ApplyNodes(request.clusterId, [...request.nodeIds]),
    );
    return { executionId: execution.id };
  }
}
