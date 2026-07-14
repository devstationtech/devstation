export type RawCluster = {
  id: string;
  name: string;
  provider: string;
  version: number;
  connection: { host: string; vaultId: string; secretId: string } | null;
  creation: { by: string; hostname: string; at: string };
};
