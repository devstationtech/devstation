import type { RawNodeImage } from "@server/cluster/application/queries/images/all/types/raw-node-image.ts";
import type { RawVirtualMachine } from "@server/cluster/application/queries/images/all/types/raw-virtual-machine.ts";

export type RawNode = {
  id: string;
  name: string;
  images: RawNodeImage[];
  virtualMachines: RawVirtualMachine[];
};
