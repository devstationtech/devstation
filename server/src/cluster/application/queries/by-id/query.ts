import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ClusterRecord } from "@server/cluster/application/queries/records/cluster-record.ts";
import type { RawCluster } from "@server/cluster/application/queries/by-id/types/raw-cluster.ts";

const FILE = "clusters.json";

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(id: string): Promise<ClusterRecord | null> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(FILE);
    const cluster = clusters.find((c) => c.id === id);
    if (!cluster) return null;
    return {
      id: cluster.id,
      name: cluster.name,
      provider: cluster.provider,
      connected: cluster.connection !== null,
      version: cluster.version,
      creation: cluster.creation,
    };
  }
}
