import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { UnregisterNode } from "@server/cluster/application/commands/proxmox/unregister-node.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class UnregisterNodeHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: UnregisterNode): Promise<void> {
    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        cluster.unregisterNode(new NodeId(command.nodeId));
      },
    );
  }
}
