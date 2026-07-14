import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawCluster } from "@server/cluster/application/queries/proxmox/virtual-machine/by-image/types/raw-cluster.ts";
import type { VirtualMachineByImageRecord } from "@server/cluster/application/queries/proxmox/virtual-machine/by-image/types/virtual-machine-by-image-record.ts";

const CLUSTERS_FILE = "clusters.json";

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(imageId: string): Promise<VirtualMachineByImageRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const records: VirtualMachineByImageRecord[] = [];

    for (const cluster of clusters) {
      for (const node of cluster.nodes) {
        for (const vm of node.virtualMachines) {
          if (vm.image === imageId) {
            records.push({
              clusterId: cluster.id,
              clusterName: cluster.name,
              nodeId: node.id,
              nodeName: node.name,
              virtualMachineId: vm.id,
              virtualMachineName: vm.name,
            });
          }
        }
      }
    }

    return records;
  }
}
