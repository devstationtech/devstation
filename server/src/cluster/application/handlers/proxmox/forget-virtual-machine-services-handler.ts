import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { ForgetVirtualMachineServices } from "@server/cluster/application/commands/proxmox/forget-virtual-machine-services.ts";

/**
 * Drops the service projection from the matching VM (by host) across all
 * known clusters. Clusters without a matching VM are left untouched; clusters
 * with at least one match are persisted once. The inverse of
 * `RecordVirtualMachineServicesHandler`.
 */
export class ForgetVirtualMachineServicesHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: ForgetVirtualMachineServices): Promise<void> {
    if (command.hosts.length === 0) return;

    const all = await this.clusters.all() as ProxmoxCluster[];

    for (const host of command.hosts) {
      for (const cluster of all) {
        if (cluster.forgetVirtualMachineServices(host, command.serviceId)) {
          await this.clusters.update<ProxmoxCluster>(
            cluster.id,
            (c) => {
              c.forgetVirtualMachineServices(host, command.serviceId);
            },
          );
          break;
        }
      }
    }
  }
}
