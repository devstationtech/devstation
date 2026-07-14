import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { RecordVirtualMachineServices } from "@server/cluster/application/commands/proxmox/record-virtual-machine-services.ts";

/**
 * Records the projection of each entry in the command on the matching VM
 * (by host) across all known clusters. Clusters without a matching VM are
 * left untouched; clusters with at least one match are persisted once.
 */
export class RecordVirtualMachineServicesHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: RecordVirtualMachineServices): Promise<void> {
    const entries = command.toServices();
    if (entries.length === 0) return;

    const all = await this.clusters.all() as ProxmoxCluster[];

    for (const { host, service } of entries) {
      for (const cluster of all) {
        // Detect the owning cluster on the snapshot (a throwaway copy
        // from all()); the real mutation is replayed fresh under the
        // lock via update(). One host belongs to at most one cluster.
        if (cluster.recordVirtualMachineService(host, service)) {
          await this.clusters.update<ProxmoxCluster>(
            cluster.id,
            (c) => {
              c.recordVirtualMachineService(host, service);
            },
          );
          break;
        }
      }
    }
  }
}
