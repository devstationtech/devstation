import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ProxmoxConnectionListRecord } from "@server/cluster/application/queries/proxmox/records/connection-list-record.ts";
import type { RawCluster } from "@server/cluster/application/queries/proxmox/connection/all/types/raw-cluster.ts";

const CLUSTERS_FILE = "clusters.json";

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(clusterId: string): Promise<ProxmoxConnectionListRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster || !cluster.connection) return [];

    // Expose resolved policy; legacy connections without a `policy`
    // field default to auto / 1.
    const policy = cluster.connection.policy;
    return [{
      host: cluster.connection.host,
      vaultId: cluster.connection.vaultId,
      secretId: cluster.connection.secretId,
      cloneStrategy: policy?.cloneStrategy ?? "auto",
      parallelism: policy?.parallelism ?? 1,
    }];
  }
}
