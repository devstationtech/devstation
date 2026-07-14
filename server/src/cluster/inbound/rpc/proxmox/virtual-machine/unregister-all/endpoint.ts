import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxVirtualMachineUnregisterAllRequest,
  ClusterProxmoxVirtualMachineUnregisterAllResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { UnregisterAllVirtualMachinesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-virtual-machines-handler.ts";
import { UnregisterAllVirtualMachines } from "@server/cluster/application/commands/proxmox/unregister-all-virtual-machines.ts";

/** Endpoint `cluster.proxmox.virtualMachine.unregisterAll` — drops every VM from a node. */
export class UnregisterAllVirtualMachinesEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.virtualMachine.unregisterAll",
    ClusterProxmoxVirtualMachineUnregisterAllRequest,
    ClusterProxmoxVirtualMachineUnregisterAllResponse
  > {
  readonly method = "cluster.proxmox.virtualMachine.unregisterAll" as const;

  constructor(private readonly handler: UnregisterAllVirtualMachinesHandler) {}

  async dispatch(
    request: ClusterProxmoxVirtualMachineUnregisterAllRequest,
  ): Promise<ClusterProxmoxVirtualMachineUnregisterAllResponse> {
    await this.handler.handle(
      new UnregisterAllVirtualMachines(request.clusterId, request.nodeId),
    );
    return {};
  }
}
