import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export type VirtualMachineServiceRecord = {
  serviceId: string;
  serviceName: string;
  stack: string;
  role: string;
  installedAt: string;
};

export type ProxmoxVirtualMachineRecord = {
  id: number;
  name?: string;
  tags?: string[];
  sizeId: string;
  image?: string;
  address: string;
  gateway?: string;
  dns?: string;
  storage?: string;
  credentialVaultId?: string;
  usernameSecretId?: string;
  passwordSecretId?: string;
  resources: { cpu: number; ram: number; disk: number };
  services?: VirtualMachineServiceRecord[];
};

export type NodeImageRecord = {
  imageId: string;
  name?: string;
  os?: string;
  sourceUrl?: string;
  virtualMachineId: number;
  storage: string;
};

export type ProxmoxNodeRecord = {
  id: string;
  name: string;
  address: string;
  credential?: {
    vaultId: string;
    usernameSecretId: string;
    passwordSecretId: string;
  };
  images?: NodeImageRecord[];
  virtualMachines: ProxmoxVirtualMachineRecord[];
  state?: string;
};

export type ImageRecord = {
  id: string;
  name: string;
  imageUrl: string;
  os: string;
};

export type ProxmoxConnectionRecord = {
  host: string;
  vaultId: string;
  secretId: string;
  policy?: { cloneStrategy: string; parallelism: number };
};

export type ClusterRecord = {
  provider?: string;
  id: string;
  name: string;
  version: number;
  creation: { by: string; hostname: string; at: string };
  connection?: ProxmoxConnectionRecord | null;
  /** Legacy: older files kept an image catalog here; no longer written. */
  images?: ImageRecord[];
  nodes: ProxmoxNodeRecord[];
};

export class Persistence {
  constructor(readonly dir: string = Deno.makeTempDirSync()) {}

  teardown(): Promise<void> {
    return Deno.remove(this.dir, { recursive: true });
  }

  async readClusters(): Promise<ClusterRecord[]> {
    const raw = await readFile(join(this.dir, "clusters.json"), "utf-8");
    return JSON.parse(raw);
  }

  writeClusters(records: ClusterRecord[]): Promise<void> {
    return writeFile(
      join(this.dir, "clusters.json"),
      JSON.stringify(records, null, 2) + "\n",
      "utf-8",
    );
  }
}
