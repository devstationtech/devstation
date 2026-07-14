import type { RawConnection } from "@server/cluster/application/queries/proxmox/virtual-machine/metrics/types/raw-connection.ts";
import type { RawNode } from "@server/cluster/application/queries/proxmox/virtual-machine/metrics/types/raw-node.ts";

export type RawCluster = {
  id: string;
  provider: string;
  connection: RawConnection | null;
  nodes: RawNode[];
};
