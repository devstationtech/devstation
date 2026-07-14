import { Aggregate } from "@server/shared/building-blocks/domain/models/aggregate.ts";
import type { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import { Id } from "@server/vault/domain/models/id.ts";
import type { Name } from "@server/vault/domain/models/name.ts";
import { Secret } from "@server/vault/domain/models/secret/secret.ts";
import type { Name as SecretName } from "@server/vault/domain/models/secret/name.ts";
import type { Id as SecretId } from "@server/vault/domain/models/secret/id.ts";
import { SecretAlreadyExists } from "@server/vault/domain/exceptions/secret-already-exists.ts";
import { SecretNotFound } from "@server/vault/domain/exceptions/secret-not-found.ts";
import type { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";

export class Vault extends Aggregate {
  private _name: Name;

  constructor(
    readonly id: Id,
    name: Name,
    creation: Creation,
    private readonly items: Secret[] = [],
    version?: Version,
  ) {
    super(creation, version);
    this._name = name;
  }

  get name(): Name {
    return this._name;
  }

  get secrets(): Secret[] {
    return [...this.items];
  }

  /** Renames the vault in place — the id (and every reference to it) is kept. */
  rename(name: Name): void {
    this._name = name;
    this.bump();
  }

  /**
   * Renames a secret in place, preserving its id, encrypted value, description
   * and creation — so every service that references the secret by id keeps
   * working. Rejects if another secret already carries the target name.
   */
  renameSecret(id: SecretId, name: SecretName): void {
    const index = this.items.findIndex((s) => s.id.value === id.value);
    if (index === -1) throw new SecretNotFound();
    if (this.items.some((s) => s.id.value !== id.value && s.name.value === name.value)) {
      throw new SecretAlreadyExists();
    }
    const old = this.items[index];
    this.items[index] = new Secret(old.id, name, old.value, old.description, old.creation);
    this.bump();
  }

  generate(secret: Secret): void {
    this.checkExists(secret);
    this.items.push(secret);
    this.bump();
  }

  /**
   * Upsert variant of `generate`: replaces an existing secret with the same
   * name (purging the old encrypted value) or adds fresh. Used by the
   * service-install listener to overwrite published secrets on re-install.
   */
  regenerate(secret: Secret): void {
    const index = this.items.findIndex(
      (s) => s.name.value === secret.name.value,
    );
    if (index >= 0) this.items.splice(index, 1);
    this.items.push(secret);
    this.bump();
  }

  delete(id: SecretId): void {
    const index = this.items.findIndex((secret) => secret.id.value === id.value);
    if (index === -1) throw new SecretNotFound();
    this.items.splice(index, 1);
    this.bump();
  }

  private checkExists(secret: Secret): void {
    if (this.items.some((s) => s.name.value === secret.name.value)) throw new SecretAlreadyExists();
  }

  static create(name: Name, creation: Creation): Vault {
    return new Vault(new Id(), name, creation);
  }
}
