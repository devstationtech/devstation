export type RawNode = {
  id: string;
  name: string;
  virtualMachines: unknown[];
};

export type RawCluster = {
  id: string;
  name: string;
  provider: string;
  version: number;
  connection: { host: string; vaultId: string; secretId: string } | null;
  nodes?: RawNode[];
  creation: { by: string; hostname: string; at: string };
};
