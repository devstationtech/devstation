import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxNodesRegisterRequest,
  ClusterProxmoxNodesRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { RegisterNodeHandler } from "@server/cluster/application/handlers/proxmox/register-node-handler.ts";
import { RegisterNode } from "@server/cluster/application/commands/proxmox/register-node.ts";

/**
 * Endpoint `cluster.proxmox.nodes.register` — adds a new node to a Proxmox
 * cluster. Node id is generated server-side.
 *
 * Thin inbound adapter: hands the command to `RegisterNodeHandler`.
 * Returns an empty Ack on success.
 */
export class RegisterNodeEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.nodes.register",
    ClusterProxmoxNodesRegisterRequest,
    ClusterProxmoxNodesRegisterResponse
  > {
  readonly method = "cluster.proxmox.nodes.register" as const;

  constructor(private readonly handler: RegisterNodeHandler) {}

  async dispatch(
    request: ClusterProxmoxNodesRegisterRequest,
  ): Promise<ClusterProxmoxNodesRegisterResponse> {
    await this.handler.handle(
      new RegisterNode(
        request.clusterId,
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
