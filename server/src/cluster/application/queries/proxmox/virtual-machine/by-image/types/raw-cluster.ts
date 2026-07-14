import type { RawNode } from "@server/cluster/application/queries/proxmox/virtual-machine/by-image/types/raw-node.ts";

export type RawCluster = {
  id: string;
  name: string;
  nodes: RawNode[];
};
