import type { Resource } from "@server/shared/inbound/mcp/resource/resource.ts";
import type { Query as AllBlueprintsQuery } from "@server/blueprint/application/queries/all/query.ts";
import { toWire } from "@server/blueprint/inbound/rpc/to-wire.ts";

/**
 * MCP resource `devstation://blueprints` — blueprint catalog. Same
 * `toWire` mapping the RPC + MCP endpoint counterparts use.
 */
export class BlueprintsResource implements Resource {
  readonly uri = "devstation://blueprints" as const;
  readonly name = "blueprints" as const;
  readonly description = "Blueprint catalog";

  constructor(private readonly query: AllBlueprintsQuery) {}

  async read(): Promise<unknown> {
    const records = await this.query.execute();
    return records.map(toWire);
  }
}
