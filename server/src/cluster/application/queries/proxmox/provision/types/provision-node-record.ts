import type { ProvisionVirtualMachineRecord } from "@server/cluster/application/queries/proxmox/provision/types/provision-virtual-machine-record.ts";

// VMs hang directly off the node (no environment grouping).
export type ProvisionNodeRecord = {
  id: string;
  name: string;
  ip: string;
  hasCredential: boolean;
  virtualMachines: ProvisionVirtualMachineRecord[];
};
