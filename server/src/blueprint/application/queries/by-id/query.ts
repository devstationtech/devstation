import type { Blueprints } from "@server/blueprint/blueprints.ts";
import { Name } from "@server/blueprint/index.ts";
import { BlueprintNotFound } from "@server/blueprint/exceptions/blueprint-not-found.ts";
import type { BlueprintRecord } from "@server/blueprint/application/queries/records/blueprint-record.ts";
import { toRecord } from "@server/blueprint/application/queries/records/to-record.ts";

export class Query {
  constructor(private readonly catalog: Blueprints) {}

  async execute(idOrName: string): Promise<BlueprintRecord | null> {
    try {
      const entry = await this.catalog.entryOf(new Name(idOrName));
      return toRecord(entry.blueprint, entry.origin);
    } catch (err) {
      if (err instanceof BlueprintNotFound) return null;
      throw err;
    }
  }
}
