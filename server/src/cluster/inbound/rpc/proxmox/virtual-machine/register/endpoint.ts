import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxVirtualMachineRegisterRequest,
  ClusterProxmoxVirtualMachineRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { RegisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/register-virtual-machine-handler.ts";
import { RegisterVirtualMachine } from "@server/cluster/application/commands/proxmox/register-virtual-machine.ts";

/**
 * Endpoint `cluster.proxmox.virtualMachine.register` — adds a virtual-machine
 * size to a node. Requires an assigned image and resource/network/
 * credential bundles. Rejects on duplicate virtualMachineId, conflicting IP, or
 * missing image association.
 */
export class RegisterVirtualMachineEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.virtualMachine.register",
    ClusterProxmoxVirtualMachineRegisterRequest,
    ClusterProxmoxVirtualMachineRegisterResponse
  > {
  readonly method = "cluster.proxmox.virtualMachine.register" as const;

  constructor(private readonly handler: RegisterVirtualMachineHandler) {}

  async dispatch(
    request: ClusterProxmoxVirtualMachineRegisterRequest,
  ): Promise<ClusterProxmoxVirtualMachineRegisterResponse> {
    await this.handler.handle(
      new RegisterVirtualMachine(
        request.clusterId,
        request.nodeId,
        request.name,
        request.id,
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
