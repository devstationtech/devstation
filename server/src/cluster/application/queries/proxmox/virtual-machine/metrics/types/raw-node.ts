import type { RawVirtualMachine } from "@server/cluster/application/queries/proxmox/virtual-machine/metrics/types/raw-virtual-machine.ts";

export type RawNode = {
  id: string;
  name: string;
  virtualMachines: RawVirtualMachine[];
};
