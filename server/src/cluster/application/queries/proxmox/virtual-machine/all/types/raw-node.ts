import type { RawVirtualMachine } from "@server/cluster/application/queries/proxmox/virtual-machine/all/types/raw-virtual-machine.ts";

export type RawNodeImage = {
  imageId: string;
  name?: string;
  os?: string;
};

export type RawNode = {
  id: string;
  name: string;
  images: RawNodeImage[];
  virtualMachines: RawVirtualMachine[];
};
