import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import type { UnregisterVirtualMachine } from "@server/cluster/application/commands/proxmox/unregister-virtual-machine.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class UnregisterVirtualMachineHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: UnregisterVirtualMachine): Promise<void> {
    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        cluster.unregisterVirtualMachine(
          new NodeId(command.nodeId),
          new VirtualMachineId(command.id),
        );
      },
    );
  }
}
