import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxProvisioningDestroyRequest,
  ClusterProxmoxProvisioningDestroyResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { DestroyNodesHandler } from "@server/cluster/application/handlers/proxmox/provisioning/destroy-nodes-handler.ts";
import { DestroyNodes } from "@server/cluster/application/commands/proxmox/provisioning/destroy-nodes.ts";

/**
 * Endpoint `cluster.proxmox.provisioning.destroy` — fire-and-return.
 *
 * Hands the command to `DestroyNodesHandler`, which starts an Execution and
 * returns the read handle. The endpoint acknowledges with `{ executionId }`;
 * the UI attaches via `operation.watch(executionId)` to receive
 * `operation.event` notifications (Log/Step/Succeeded/Failed/
 * Cancelled). Cancellation goes through `operation.cancel(executionId)`.
 */
export class DestroyEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.provisioning.destroy",
    ClusterProxmoxProvisioningDestroyRequest,
    ClusterProxmoxProvisioningDestroyResponse
  > {
  readonly method = "cluster.proxmox.provisioning.destroy" as const;

  constructor(private readonly handler: DestroyNodesHandler) {}

  async dispatch(
    request: ClusterProxmoxProvisioningDestroyRequest,
  ): Promise<ClusterProxmoxProvisioningDestroyResponse> {
    const execution = await this.handler.handle(
      new DestroyNodes(request.clusterId, [...request.nodeIds]),
    );
    return { executionId: execution.id };
  }
}
