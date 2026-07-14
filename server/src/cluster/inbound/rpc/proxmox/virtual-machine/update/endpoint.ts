import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxVirtualMachineUpdateRequest,
  ClusterProxmoxVirtualMachineUpdateResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { UpdateVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/update-virtual-machine-handler.ts";
import { UpdateVirtualMachine } from "@server/cluster/application/commands/proxmox/update-virtual-machine.ts";

/**
 * Endpoint `cluster.proxmox.virtualMachine.update` — replaces the mutable fields of
 * an existing VM size on a node.
 */
export class UpdateVirtualMachineEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.virtualMachine.update",
    ClusterProxmoxVirtualMachineUpdateRequest,
    ClusterProxmoxVirtualMachineUpdateResponse
  > {
  readonly method = "cluster.proxmox.virtualMachine.update" as const;

  constructor(private readonly handler: UpdateVirtualMachineHandler) {}

  async dispatch(
    request: ClusterProxmoxVirtualMachineUpdateRequest,
  ): Promise<ClusterProxmoxVirtualMachineUpdateResponse> {
    await this.handler.handle(
      new UpdateVirtualMachine(
        request.clusterId,
        request.nodeId,
        request.id,
        request.name,
        request.size,
        request.image,
        request.ip,
        request.gateway,
        request.dns,
        request.storage,
        request.cpu,
        request.ram,
        request.disk,
        request.credentialVaultId,
        request.usernameSecretId,
        request.passwordSecretId,
        request.tags ? [...request.tags] : [],
      ),
    );
    return {};
  }
}
