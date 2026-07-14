import type { ProxmoxLiveResources } from "@server/cluster/application/queries/proxmox/records/live-resources.ts";
import type { ProxmoxStorageRecord } from "@server/cluster/application/queries/proxmox/records/storage-record.ts";
import type { ProxmoxVirtualMachineMetricPointRecord } from "@server/cluster/application/queries/proxmox/records/virtual-machine-metric-point.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";
import type { ProxmoxMetricsTimeframe } from "@server/cluster/application/queries/proxmox/records/metrics-timeframe.ts";
import type { ClusterResource } from "@server/cluster/application/queries/proxmox/api/response/cluster-resource.ts";
import type { ProxmoxConfig } from "@server/cluster/application/queries/proxmox/api/config.ts";
import { ProxmoxIntegration } from "@server/cluster/application/queries/proxmox/api/integration.ts";

const toGiB = (bytes: number) => Number((bytes / (1024 * 1024 * 1024)).toFixed(2));
const toMBs = (bytesPerSec: number) => Number((bytesPerSec / (1024 * 1024)).toFixed(3));

export class ProxmoxApiAdapter implements ProxmoxReadApi {
  private readonly integration: ProxmoxIntegration;

  constructor(config: ProxmoxConfig, integration?: ProxmoxIntegration) {
    this.integration = integration ?? new ProxmoxIntegration(config.host, config.token);
  }

  async liveNodes(): Promise<Map<string, ProxmoxLiveResources>> {
    const resources = await this.integration.clusterResources();
    return new Map(
      resources
        .filter((r) => r.type === "node" && !!r.node)
        .map((r) => [r.node!, this.toLiveResources(r)]),
    );
  }

  async liveVirtualMachines(nodeName: string): Promise<Map<number, ProxmoxLiveResources>> {
    const resources = await this.integration.clusterResources();
    return new Map(
      resources
        .filter((r) => r.type === "qemu" && r.node === nodeName && !!r.vmid)
        .map((r) => [r.vmid!, this.toLiveResources(r)]),
    );
  }

  async storages(nodeName: string): Promise<ProxmoxStorageRecord[]> {
    const storages = await this.integration.nodeStorages(nodeName);
    return storages.map((s) => ({
      id: s.storage,
      type: s.type,
      available: s.avail ?? 0,
      total: s.total ?? 0,
    }));
  }

  async vmMetrics(
    nodeName: string,
    virtualMachineId: number,
    timeframe: ProxmoxMetricsTimeframe,
  ): Promise<ProxmoxVirtualMachineMetricPointRecord[]> {
    const points = await this.integration.vmMetrics(nodeName, virtualMachineId, timeframe);
    return points.map((p) => ({
      time: p.time,
      cpuPercent: Math.round((p.cpu ?? 0) * 100),
      ramUsedGiB: toGiB(p.mem ?? 0),
      ramTotalGiB: toGiB(p.maxmem ?? 0),
      diskReadMBs: toMBs(p.diskread ?? 0),
      diskWriteMBs: toMBs(p.diskwrite ?? 0),
      netInMBs: toMBs(p.netin ?? 0),
      netOutMBs: toMBs(p.netout ?? 0),
    }));
  }

  private toLiveResources(r: ClusterResource): ProxmoxLiveResources {
    return {
      status: r.status ?? "unknown",
      cpuCores: r.maxcpu ?? 0,
      cpuPercent: Math.round((r.cpu ?? 0) * 100),
      ramUsedGiB: toGiB(r.mem ?? 0),
      ramTotalGiB: toGiB(r.maxmem ?? 0),
      diskUsedGiB: toGiB(r.disk ?? 0),
      diskTotalGiB: toGiB(r.maxdisk ?? 0),
      uptimeSeconds: r.uptime ?? 0,
    };
  }
}
