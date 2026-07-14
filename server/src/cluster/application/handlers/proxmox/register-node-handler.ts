import { Id } from "@server/cluster/domain/models/id.ts";
import type { RegisterNode } from "@server/cluster/application/commands/proxmox/register-node.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class RegisterNodeHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: RegisterNode): Promise<void> {
    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        cluster.registerNode(command.toNode());
      },
    );
  }
}
