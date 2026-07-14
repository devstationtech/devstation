import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxNodesUnregisterRequest,
  ClusterProxmoxNodesUnregisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { UnregisterNodeHandler } from "@server/cluster/application/handlers/proxmox/unregister-node-handler.ts";
import { UnregisterNode } from "@server/cluster/application/commands/proxmox/unregister-node.ts";

/**
 * Endpoint `cluster.proxmox.nodes.unregister` — removes a Proxmox node
 * from its cluster. Rejects if the node still has virtual-machines.
 */
export class UnregisterNodeEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.nodes.unregister",
    ClusterProxmoxNodesUnregisterRequest,
    ClusterProxmoxNodesUnregisterResponse
  > {
  readonly method = "cluster.proxmox.nodes.unregister" as const;

  constructor(private readonly handler: UnregisterNodeHandler) {}

  async dispatch(
    request: ClusterProxmoxNodesUnregisterRequest,
  ): Promise<ClusterProxmoxNodesUnregisterResponse> {
    await this.handler.handle(
      new UnregisterNode(request.clusterId, request.nodeId),
    );
    return {};
  }
}
