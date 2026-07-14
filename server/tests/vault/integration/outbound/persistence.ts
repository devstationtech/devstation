import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type SecretRecord = {
  id: string;
  name: string;
  value: string;
  description: string | null;
  at: string;
  by: string;
  hostname: string;
};

type VaultRecord = {
  id: string;
  version: number;
  name: string;
  creation: { by: string; hostname: string; at: string };
  secrets: SecretRecord[];
};

const FILENAME = "vaults.json";

export class Persistence {
  constructor(readonly dir: string = Deno.makeTempDirSync()) {}

  teardown(): Promise<void> {
    return Deno.remove(this.dir, { recursive: true });
  }

  async readVault(name: string): Promise<VaultRecord> {
    const raw = await readFile(join(this.dir, FILENAME), "utf-8");
    const vaults = JSON.parse(raw) as VaultRecord[];
    const vault = vaults.find((v) => v.name === name);
    if (!vault) throw new Error(`vault '${name}' not found.`);
    return vault;
  }

  async writeVault(data: VaultRecord): Promise<void> {
    let vaults: VaultRecord[] = [];
    try {
      const raw = await readFile(join(this.dir, FILENAME), "utf-8");
      vaults = JSON.parse(raw) as VaultRecord[];
    } catch { /* file may not exist yet */ }
    const index = vaults.findIndex((v) => v.id === data.id);
    if (index === -1) vaults.push(data);
    else vaults[index] = data;
    await writeFile(join(this.dir, FILENAME), JSON.stringify(vaults, null, 2) + "\n", "utf-8");
  }
}
