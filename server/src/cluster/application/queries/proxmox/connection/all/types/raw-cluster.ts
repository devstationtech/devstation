import type { RawConnection } from "@server/cluster/application/queries/proxmox/connection/all/types/raw-connection.ts";

export type RawCluster = {
  id: string;
  connection: RawConnection | null;
};
