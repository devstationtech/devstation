import type { RawCredential } from "@server/cluster/application/queries/proxmox/provision/types/raw-credential.ts";
import type { RawNodeImage } from "@server/cluster/application/queries/proxmox/provision/types/raw-node-image.ts";
import type { RawVirtualMachine } from "@server/cluster/application/queries/proxmox/provision/types/raw-virtual-machine.ts";

export type RawNode = {
  id: string;
  name: string;
  address: string;
  credential: RawCredential;
  images: RawNodeImage[];
  virtualMachines: RawVirtualMachine[];
};
