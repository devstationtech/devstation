import type { Blueprint } from "@server/blueprint/domain/models/blueprint.ts";
import type { Name } from "@server/blueprint/domain/models/name.ts";

/**
 * Read-only catalog port for station handlers / orchestration. Station owns
 * this contract; the adapter in `station/outbound/blueprints/` wraps the
 * upstream blueprint BC's `Blueprints` catalog. Domain types are imported
 * from the blueprint BC as published language — they are stable contracts
 * blueprint commits to maintaining.
 */
export interface Blueprints {
  of(name: Name): Promise<Blueprint>;
  contains(name: Name): Promise<boolean>;
  list(): Promise<Blueprint[]>;
}
