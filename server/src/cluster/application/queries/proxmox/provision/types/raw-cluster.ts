import type { RawConnection } from "@server/cluster/application/queries/proxmox/provision/types/raw-connection.ts";
import type { RawNode } from "@server/cluster/application/queries/proxmox/provision/types/raw-node.ts";

export type RawCluster = {
  id: string;
  name: string;
  nodes: RawNode[];
  connection: RawConnection | null;
};
