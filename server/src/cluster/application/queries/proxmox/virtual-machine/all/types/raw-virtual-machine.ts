import type { VirtualMachineServiceRecord } from "@server/cluster/application/queries/proxmox/records/virtual-machine-service-record.ts";

export type RawVirtualMachine = {
  id: number;
  name: string;
  tags?: string[];
  sizeId: string;
  image: string;
  address: string;
  gateway: string;
  dns: string;
  storage: string;
  credentialVaultId: string;
  usernameSecretId: string;
  passwordSecretId: string;
  resources: { cpu: number; ram: number; disk: number };
  services?: VirtualMachineServiceRecord[];
};
