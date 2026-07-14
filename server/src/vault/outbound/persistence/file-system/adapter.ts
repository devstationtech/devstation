import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Vault } from "@server/vault/domain/models/vault.ts";
import { Id } from "@server/vault/domain/models/id.ts";
import { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import { Name } from "@server/vault/domain/models/name.ts";
import { Secret } from "@server/vault/domain/models/secret/secret.ts";
import { Id as SecretId } from "@server/vault/domain/models/secret/id.ts";
import { Name as SecretName } from "@server/vault/domain/models/secret/name.ts";
import { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import { Description } from "@server/vault/domain/models/secret/description.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import { VaultNotFound } from "@server/vault/domain/exceptions/vault-not-found.ts";

const FILENAME = "vaults.json";

type SecretData = {
  id: string;
  name: string;
  value: string;
  description: string | null;
  at: string;
  by: string;
  hostname: string;
};

type VaultData = {
  id: string;
  version: number;
  name: string;
  creation: { by: string; hostname: string; at: string };
  secrets: SecretData[];
};

export class Adapter implements Vaults {
  constructor(private readonly fs: FileSystem) {}

  async of(id: Id): Promise<Vault> {
    const all = await this.readAll();
    const data = all.find((v) => v.id === id.value);
    if (!data) throw new VaultNotFound();
    return this.deserialize(data);
  }

  async save(vault: Vault): Promise<void> {
    const all = await this.readAll();
    const index = all.findIndex((v) => v.id === vault.id.value);
    const data = this.serialize(vault);
    if (index === -1) all.push(data);
    else all[index] = data;
    await this.write(all);
  }

  async exists(name: Name): Promise<boolean> {
    const all = await this.readAll();
    return all.some((v) => v.name === name.value);
  }

  async byName(name: Name): Promise<Vault | null> {
    const all = await this.readAll();
    const data = all.find((v) => v.name === name.value);
    return data ? this.deserialize(data) : null;
  }

  async remove(id: Id): Promise<void> {
    const all = await this.readAll();
    const filtered = all.filter((v) => v.id !== id.value);
    if (filtered.length === all.length) throw new VaultNotFound();
    await this.write(filtered);
  }

  private async readAll(): Promise<VaultData[]> {
    return await this.fs.readObjectsOf<VaultData>(FILENAME);
  }

  private write(vaults: VaultData[]): Promise<void> {
    return this.fs.writeObjectsOf(FILENAME, vaults);
  }

  private deserialize(data: VaultData): Vault {
    const secrets = data.secrets.map((record) =>
      new Secret(
        new SecretId(record.id),
        new SecretName(record.name),
        new Encrypted(record.value),
        record.description ? new Description(record.description) : null,
        new Creation(
          new User(record.by),
          new Hostname(record.hostname),
          Instant.fromString(record.at),
        ),
      )
    );
    return new Vault(
      new Id(data.id),
      new Name(data.name),
      new Creation(
        new User(data.creation.by),
        new Hostname(data.creation.hostname),
        Instant.fromString(data.creation.at),
      ),
      secrets,
      new Version(data.version),
    );
  }

  private serialize(vault: Vault): VaultData {
    return {
      id: vault.id.value,
      version: vault.version.value,
      name: vault.name.value,
      creation: {
        by: vault.creation.by.value,
        hostname: vault.creation.hostname.value,
        at: vault.creation.at.toString(),
      },
      secrets: vault.secrets.map((secret) => ({
        id: secret.id.value,
        name: secret.name.value,
        value: secret.value.value,
        description: secret.description?.value ?? null,
        at: secret.creation.at.toString(),
        by: secret.creation.by.value,
        hostname: secret.creation.hostname.value,
      })),
    };
  }
}
