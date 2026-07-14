import type { RawCredential } from "@server/cluster/application/queries/proxmox/node/all/types/raw-credential.ts";

export type RawNode = {
  id: string;
  name: string;
  address: string;
  credential: RawCredential;
  virtualMachines: unknown[];
  state?: string;
};
