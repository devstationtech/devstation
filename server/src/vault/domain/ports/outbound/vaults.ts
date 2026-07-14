import type { Vault } from "@server/vault/domain/models/vault.ts";
import type { Id } from "@server/vault/domain/models/id.ts";
import type { Name } from "@server/vault/domain/models/name.ts";

export interface Vaults {
  of(id: Id): Promise<Vault>;
  byName(name: Name): Promise<Vault | null>;
  save(vault: Vault): Promise<void>;
  exists(name: Name): Promise<boolean>;
  remove(id: Id): Promise<void>;
}
