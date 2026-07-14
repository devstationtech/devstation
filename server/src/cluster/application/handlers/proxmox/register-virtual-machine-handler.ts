import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { RegisterVirtualMachine } from "@server/cluster/application/commands/proxmox/register-virtual-machine.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class RegisterVirtualMachineHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: RegisterVirtualMachine): Promise<void> {
    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        cluster.registerVirtualMachine(new NodeId(command.nodeId), command.toVirtualMachine());
      },
    );
  }
}
