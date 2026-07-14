// Raw RRD point as returned by Proxmox /qemu/{vmid}/rrddata.
// Fields are optional because Proxmox can omit gaps in the series.
export type VirtualMachineMetricPoint = {
  time: number;
  cpu?: number; // 0..1 (fraction of allocated cpu)
  maxcpu?: number; // total allocated cores
  mem?: number; // bytes
  maxmem?: number; // bytes
  disk?: number; // bytes
  maxdisk?: number; // bytes
  diskread?: number; // bytes/s
  diskwrite?: number; // bytes/s
  netin?: number; // bytes/s
  netout?: number; // bytes/s
};
