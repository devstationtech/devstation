import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawCluster } from "@server/cluster/application/queries/proxmox/provision/types/raw-cluster.ts";
import type { TagUsageRecord } from "@server/cluster/application/queries/proxmox/virtual-machine/tags/all/types/tag-usage-record.ts";

const CLUSTERS_FILE = "clusters.json";

/**
 * Distinct VM tags already in use, across every cluster/node, with
 * usage count. There is no central tag catalog — this read query is
 * the only reuse surface (the VM form surfaces it as suggestions).
 * Ordered by count desc, then tag asc, for a stable, useful list.
 */
export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<TagUsageRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const counts = new Map<string, number>();
    for (const cluster of clusters) {
      for (const node of cluster.nodes) {
        for (const vm of node.virtualMachines) {
          for (const tag of vm.tags ?? []) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
          }
        }
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }
}
