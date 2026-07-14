import type { RawConnection } from "@server/cluster/application/queries/proxmox/storage/by-node/types/raw-connection.ts";
import type { RawNode } from "@server/cluster/application/queries/proxmox/storage/by-node/types/raw-node.ts";

export type RawCluster = {
  id: string;
  provider: string;
  connection: RawConnection | null;
  nodes: RawNode[];
};
