import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxNodesUpdateRequest,
  ClusterProxmoxNodesUpdateResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { UpdateNodeHandler } from "@server/cluster/application/handlers/proxmox/update-node-handler.ts";
import { UpdateNode } from "@server/cluster/application/commands/proxmox/update-node.ts";

/**
 * Endpoint `cluster.proxmox.nodes.update` — replaces the mutable fields of
 * an existing Proxmox node (name, ip, credential). Images and VMs are
 * preserved by the handler.
 */
export class UpdateNodeEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.nodes.update",
    ClusterProxmoxNodesUpdateRequest,
    ClusterProxmoxNodesUpdateResponse
  > {
  readonly method = "cluster.proxmox.nodes.update" as const;

  constructor(private readonly handler: UpdateNodeHandler) {}

  async dispatch(
    request: ClusterProxmoxNodesUpdateRequest,
  ): Promise<ClusterProxmoxNodesUpdateResponse> {
    await this.handler.handle(
      new UpdateNode(
        request.clusterId,
        request.nodeId,
        request.name,
        request.ip,
        request.vaultId,
        request.usernameSecretId,
        request.passwordSecretId,
      ),
    );
    return {};
  }
}
