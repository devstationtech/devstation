import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxNodesUnregisterAllRequest,
  ClusterProxmoxNodesUnregisterAllResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { UnregisterAllNodesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-nodes-handler.ts";
import { UnregisterAllNodes } from "@server/cluster/application/commands/proxmox/unregister-all-nodes.ts";

/**
 * Endpoint `cluster.proxmox.nodes.unregisterAll` — drops every node
 * from a Proxmox cluster. Rejects if any node still has VMs attached.
 */
export class UnregisterAllNodesEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.nodes.unregisterAll",
    ClusterProxmoxNodesUnregisterAllRequest,
    ClusterProxmoxNodesUnregisterAllResponse
  > {
  readonly method = "cluster.proxmox.nodes.unregisterAll" as const;

  constructor(private readonly handler: UnregisterAllNodesHandler) {}

  async dispatch(
    request: ClusterProxmoxNodesUnregisterAllRequest,
  ): Promise<ClusterProxmoxNodesUnregisterAllResponse> {
    await this.handler.handle(new UnregisterAllNodes(request.clusterId));
    return {};
  }
}
