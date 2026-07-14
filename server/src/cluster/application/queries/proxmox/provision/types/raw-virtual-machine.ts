export type RawVirtualMachine = {
  id: number;
  name: string;
  tags?: string[];
  image: string;
  address: string;
  gateway: string;
  dns: string;
  storage: string;
  resources: { cpu: number; ram: number; disk: number };
};
