import { Id } from "@server/cluster/domain/models/id.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { DisconnectCluster } from "@server/cluster/application/commands/proxmox/disconnect-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class DisconnectClusterHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: DisconnectCluster): Promise<void> {
    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        if (!(cluster instanceof ProxmoxCluster)) {
          throw new Error(`cluster ${command.clusterId} is not a proxmox cluster`);
        }
        cluster.disconnect();
      },
    );
  }
}
