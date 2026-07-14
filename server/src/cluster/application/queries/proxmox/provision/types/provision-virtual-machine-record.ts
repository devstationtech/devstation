export type ProvisionVirtualMachineRecord = {
  id: number;
  name: string;
  tags: string[];
  image: string;
  imageName: string;
  ip: string;
  gateway: string;
  dns: string;
  storage: string;
  cpu: number;
  ram: number;
  disk: number;
};
