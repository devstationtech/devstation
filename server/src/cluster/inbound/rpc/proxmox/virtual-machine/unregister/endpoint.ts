import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxVirtualMachineUnregisterRequest,
  ClusterProxmoxVirtualMachineUnregisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { UnregisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/unregister-virtual-machine-handler.ts";
import { UnregisterVirtualMachine } from "@server/cluster/application/commands/proxmox/unregister-virtual-machine.ts";

/** Endpoint `cluster.proxmox.virtualMachine.unregister` — drops a single VM from a node. */
export class UnregisterVirtualMachineEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.virtualMachine.unregister",
    ClusterProxmoxVirtualMachineUnregisterRequest,
    ClusterProxmoxVirtualMachineUnregisterResponse
  > {
  readonly method = "cluster.proxmox.virtualMachine.unregister" as const;

  constructor(private readonly handler: UnregisterVirtualMachineHandler) {}

  async dispatch(
    request: ClusterProxmoxVirtualMachineUnregisterRequest,
  ): Promise<ClusterProxmoxVirtualMachineUnregisterResponse> {
    await this.handler.handle(
      new UnregisterVirtualMachine(request.clusterId, request.nodeId, request.id),
    );
    return {};
  }
}
