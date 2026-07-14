// Local shape mirroring the on-disk cluster record. Kept private to the
// service query slice to preserve isolation between query slices. If a
// shared read-side type module emerges, this should be consolidated.

export type RawVirtualMachine = {
  id: number;
  name: string;
  image: string;
  address: string;
  credentialVaultId: string;
  usernameSecretId: string;
  passwordSecretId: string;
  resources: { cpu: number; ram: number; disk: number };
};

export type RawNode = {
  id: string;
  name: string;
  virtualMachines: RawVirtualMachine[];
};

export type RawCluster = {
  id: string;
  name: string;
  provider: string;
  nodes: RawNode[];
};
