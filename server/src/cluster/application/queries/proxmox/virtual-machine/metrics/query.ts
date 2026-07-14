import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { ProxmoxMetricsTimeframe } from "@server/cluster/application/queries/proxmox/records/metrics-timeframe.ts";
import type { RawCluster } from "@server/cluster/application/queries/proxmox/virtual-machine/metrics/types/raw-cluster.ts";
import type { ProxmoxVirtualMachineMetricPointRecord } from "@server/cluster/application/queries/proxmox/records/virtual-machine-metric-point.ts";

const CLUSTERS_FILE = "clusters.json";

export class Query {
  constructor(
    private readonly fs: FileSystem,
    private readonly apiFactory: ProxmoxReadApiFactory,
  ) {}

  async execute(
    clusterId: string,
    nodeId: string,
    virtualMachineId: number,
    timeframe: ProxmoxMetricsTimeframe,
  ): Promise<ProxmoxVirtualMachineMetricPointRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster || !cluster.connection) return [];

    const node = cluster.nodes.find((n) => n.id === nodeId);
    if (!node) return [];

    const api = await this.apiFactory.create({
      host: cluster.connection.host,
      vaultId: cluster.connection.vaultId,
      secretId: cluster.connection.secretId,
    });
    if (!api) return [];

    return await api.vmMetrics(node.name, virtualMachineId, timeframe);
  }
}
