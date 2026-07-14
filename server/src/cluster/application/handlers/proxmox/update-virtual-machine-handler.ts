import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { UpdateVirtualMachine } from "@server/cluster/application/commands/proxmox/update-virtual-machine.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class UpdateVirtualMachineHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: UpdateVirtualMachine): Promise<void> {
    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        cluster.replaceVirtualMachine(new NodeId(command.nodeId), command.toVirtualMachine());
      },
    );
  }
}
