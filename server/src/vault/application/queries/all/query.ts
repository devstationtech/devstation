import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawVault } from "@server/vault/application/queries/all/types/raw-vault.ts";
import type { VaultRecord } from "@server/vault/application/queries/all/types/vault-record.ts";

const FILE = "vaults.json";

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<VaultRecord[]> {
    const vaults = await this.fs.readObjectsOf<RawVault>(FILE);
    return vaults.map((v) => ({ id: v.id, name: v.name, version: v.version }));
  }
}
