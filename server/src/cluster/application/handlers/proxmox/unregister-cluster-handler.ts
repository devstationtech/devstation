import { Id } from "@server/cluster/domain/models/id.ts";
import type { UnregisterCluster } from "@server/cluster/application/commands/proxmox/unregister-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class UnregisterClusterHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: UnregisterCluster): Promise<void> {
    await this.clusters.remove(new Id(command.id));
  }
}
