import type { Blueprints } from "@server/blueprint/blueprints.ts";
import type { BlueprintRecord } from "@server/blueprint/application/queries/records/blueprint-record.ts";
import { toRecord } from "@server/blueprint/application/queries/records/to-record.ts";

export class Query {
  constructor(private readonly catalog: Blueprints) {}

  async execute(): Promise<BlueprintRecord[]> {
    const entries = await this.catalog.entries();
    return entries.map((e) => toRecord(e.blueprint, e.origin));
  }
}
