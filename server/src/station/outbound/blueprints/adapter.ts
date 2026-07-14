import type { Blueprint } from "@server/blueprint/domain/models/blueprint.ts";
import type { Name } from "@server/blueprint/domain/models/name.ts";
import type { Blueprints as Catalog } from "@server/blueprint/blueprints.ts";
import type { Blueprints } from "@server/station/domain/ports/outbound/blueprints.ts";

/**
 * Anti-corruption adapter. Implements station's `Blueprints` port by
 * delegating to the upstream blueprint BC's `Blueprints` catalog injected
 * at the composition root. Keeps station handlers free of direct
 * `@server/blueprint/blueprints.ts` imports.
 */
export class Adapter implements Blueprints {
  constructor(private readonly catalog: Catalog) {}

  of(name: Name): Promise<Blueprint> {
    return this.catalog.of(name);
  }

  contains(name: Name): Promise<boolean> {
    return this.catalog.contains(name);
  }

  list(): Promise<Blueprint[]> {
    return this.catalog.list();
  }
}
