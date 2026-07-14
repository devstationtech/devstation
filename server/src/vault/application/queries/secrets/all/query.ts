import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { RawVault } from "@server/vault/application/queries/secrets/all/types/raw-vault.ts";
import type { SecretRecord } from "@server/vault/application/queries/secrets/all/types/secret-record.ts";

const FILE = "vaults.json";

export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(vaultId: string): Promise<SecretRecord[]> {
    const vaults = await this.fs.readObjectsOf<RawVault>(FILE);
    const vault = vaults.find((v) => v.id === vaultId);
    if (!vault) return [];
    return vault.secrets.map((secret) => ({
      id: secret.id,
      name: secret.name,
      description: secret.description,
      createdAt: secret.at,
      createdBy: secret.by,
    }));
  }
}
