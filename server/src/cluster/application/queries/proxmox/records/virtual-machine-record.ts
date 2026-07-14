import type { ProxmoxResources } from "@server/cluster/application/queries/proxmox/records/resources.ts";
import type { VirtualMachineServiceRecord } from "@server/cluster/application/queries/proxmox/records/virtual-machine-service-record.ts";

export type ProxmoxVirtualMachineRecord = {
  id: number;
  name: string;
  tags: string[];
  sizeId: string;
  sizeName: string;
  image: string;
  imageName: string;
  imageOs: string;
  ip: string;
  gateway: string;
  dns: string;
  storage: string;
  credentialVaultId: string;
  usernameSecretId: string;
  passwordSecretId: string;
  resources: ProxmoxResources;
  services: VirtualMachineServiceRecord[];
};
