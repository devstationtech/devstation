// Time-series point for a Proxmox VM, normalized from RRD samples.
export type ProxmoxVirtualMachineMetricPointRecord = {
  time: number; // unix seconds
  cpuPercent: number; // 0..100 (relative to all cores)
  ramUsedGiB: number; // GiB
  ramTotalGiB: number; // GiB
  diskReadMBs: number; // MB/s
  diskWriteMBs: number; // MB/s
  netInMBs: number; // MB/s
  netOutMBs: number; // MB/s
};
