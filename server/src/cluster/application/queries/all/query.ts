import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ClusterRecord } from "@server/cluster/application/queries/records/cluster-record.ts";
import type { RawCluster } from "@server/cluster/application/queries/all/types/raw-cluster.ts";

const FILE = "clusters.json";

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<ClusterRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(FILE);
    return clusters.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      connected: c.connection !== null,
      version: c.version,
      creation: c.creation,
      proxmox: c.provider === "proxmox"
        ? {
          nodeCount: c.nodes?.length ?? 0,
          virtualMachineCount: (c.nodes ?? []).reduce(
            (sum, n) => sum + (n.virtualMachines?.length ?? 0),
            0,
          ),
        }
        : undefined,
    }));
  }
}
