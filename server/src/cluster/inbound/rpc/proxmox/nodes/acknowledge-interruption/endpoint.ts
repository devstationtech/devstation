import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxNodesAcknowledgeInterruptionRequest,
  ClusterProxmoxNodesAcknowledgeInterruptionResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { AcknowledgeInterruptionHandler } from "@server/cluster/application/handlers/proxmox/acknowledge-interruption-handler.ts";
import { AcknowledgeInterruption } from "@server/cluster/application/commands/proxmox/acknowledge-interruption.ts";

/**
 * Endpoint `cluster.proxmox.nodes.acknowledgeInterruption` — operator
 * acknowledges an interrupted long-running op on a transient-state
 * node. Demotes to the matching `*_FAILED` so retry /
 * replan / destroy are valid again. Rejects when the node isn't in a
 * transient state.
 */
export class AcknowledgeInterruptionEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.nodes.acknowledgeInterruption",
    ClusterProxmoxNodesAcknowledgeInterruptionRequest,
    ClusterProxmoxNodesAcknowledgeInterruptionResponse
  > {
  readonly method = "cluster.proxmox.nodes.acknowledgeInterruption" as const;

  constructor(private readonly handler: AcknowledgeInterruptionHandler) {}

  async dispatch(
    request: ClusterProxmoxNodesAcknowledgeInterruptionRequest,
  ): Promise<ClusterProxmoxNodesAcknowledgeInterruptionResponse> {
    await this.handler.handle(
      new AcknowledgeInterruption(request.clusterId, request.nodeId),
    );
    return {};
  }
}
