export type ClusterRecord = {
  id: string;
  name: string;
  provider: string;
  connected: boolean;
  version: number;
  creation: { by: string; hostname: string; at: string };
  // Provider-specific summary slots. Each provider fills its own; UI picks the
  // matching one based on `provider` to format topology stats.
  proxmox?: {
    nodeCount: number;
    virtualMachineCount: number;
  };
};
