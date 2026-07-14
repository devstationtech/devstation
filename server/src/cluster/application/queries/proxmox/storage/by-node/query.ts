import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { RawCluster } from "@server/cluster/application/queries/proxmox/storage/by-node/types/raw-cluster.ts";
import type { StoragesByNodeRecord } from "@server/cluster/application/queries/proxmox/storage/by-node/types/storages-by-node-record.ts";

const CLUSTERS_FILE = "clusters.json";

export class Query {
  constructor(
    private readonly fs: FileSystem,
    private readonly apiFactory: ProxmoxReadApiFactory,
  ) {}

  async execute(clusterId: string, nodeId: string): Promise<StoragesByNodeRecord> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster || !cluster.connection) return { connected: false, storages: [] };

    const node = cluster.nodes.find((n) => n.id === nodeId);
    if (!node) return { connected: false, storages: [] };

    const api = await this.apiFactory.create({
      host: cluster.connection.host,
      vaultId: cluster.connection.vaultId,
      secretId: cluster.connection.secretId,
    });
    if (!api) return { connected: false, storages: [] };

    try {
      const storages = await api.storages(node.name);
      return { connected: true, storages };
    } catch {
      return { connected: false, storages: [] };
    }
  }
}
