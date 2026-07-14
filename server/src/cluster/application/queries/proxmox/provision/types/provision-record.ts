import type { ProvisionNodeRecord } from "@server/cluster/application/queries/proxmox/provision/types/provision-node-record.ts";
import type { ProvisionImageRecord } from "@server/cluster/application/queries/proxmox/provision/types/provision-image-record.ts";

export type ProvisionRecord = {
  clusterId: string;
  clusterName: string;
  connected: boolean;
  nodes: ProvisionNodeRecord[];
  images: ProvisionImageRecord[];
};
