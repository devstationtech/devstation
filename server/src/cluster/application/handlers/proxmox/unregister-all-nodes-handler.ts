import { Id } from "@server/cluster/domain/models/id.ts";
import type { UnregisterAllNodes } from "@server/cluster/application/commands/proxmox/unregister-all-nodes.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class UnregisterAllNodesHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: UnregisterAllNodes): Promise<void> {
    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        cluster.unregisterAllNodes();
      },
    );
  }
}
