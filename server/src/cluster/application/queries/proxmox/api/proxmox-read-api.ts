import type { ProxmoxLiveResources } from "@server/cluster/application/queries/proxmox/records/live-resources.ts";
import type { ProxmoxStorageRecord } from "@server/cluster/application/queries/proxmox/records/storage-record.ts";
import type { ProxmoxVirtualMachineMetricPointRecord } from "@server/cluster/application/queries/proxmox/records/virtual-machine-metric-point.ts";
import type { ProxmoxMetricsTimeframe } from "@server/cluster/application/queries/proxmox/records/metrics-timeframe.ts";

export interface ProxmoxReadApi {
  liveNodes(): Promise<Map<string, ProxmoxLiveResources>>;
  liveVirtualMachines(nodeName: string): Promise<Map<number, ProxmoxLiveResources>>;
  storages(nodeName: string): Promise<ProxmoxStorageRecord[]>;
  vmMetrics(
    nodeName: string,
    virtualMachineId: number,
    timeframe: ProxmoxMetricsTimeframe,
  ): Promise<ProxmoxVirtualMachineMetricPointRecord[]>;
}
