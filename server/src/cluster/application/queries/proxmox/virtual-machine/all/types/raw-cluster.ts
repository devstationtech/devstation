import type { RawNode } from "@server/cluster/application/queries/proxmox/virtual-machine/all/types/raw-node.ts";

export type RawConnection = {
  host: string;
  vaultId: string;
  secretId: string;
};

export type RawCluster = {
  id: string;
  provider: string;
  connection: RawConnection | null;
  nodes: RawNode[];
};
