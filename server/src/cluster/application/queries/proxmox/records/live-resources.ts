export type ProxmoxLiveResources = {
  status: string;
  cpuCores: number;
  cpuPercent: number;
  ramUsedGiB: number;
  ramTotalGiB: number;
  diskUsedGiB: number;
  diskTotalGiB: number;
  uptimeSeconds: number;
};
