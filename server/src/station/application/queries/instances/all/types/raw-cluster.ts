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

export type RawNodeImage = {
  imageId: string;
  name?: string;
  os?: string;
};

export type RawNode = {
  id: string;
  name: string;
  images: RawNodeImage[];
  virtualMachines: RawVirtualMachine[];
};

export type RawCluster = {
  id: string;
  name: string;
  provider: string;
  nodes: RawNode[];
};
