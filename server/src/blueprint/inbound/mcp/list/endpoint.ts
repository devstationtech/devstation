import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllBlueprintsQuery } from "@server/blueprint/application/queries/all/query.ts";
import { toWire } from "@server/blueprint/inbound/rpc/to-wire.ts";

/**
 * MCP endpoint `devstation_blueprint_list` — every blueprint in the
 * catalog. Handler-direct. Reuses the
 * same `toWire` mapper the RPC endpoint uses (renames `default` →
 * `value` for the contract).
 */
export class ListBlueprintsMcpEndpoint
  implements Endpoint<"devstation_blueprint_list", Record<string, never>, unknown> {
  readonly name = "devstation_blueprint_list" as const;
  readonly title = "List blueprints";
  readonly description = "Installable blueprint catalog.";
  readonly risk = "read" as const;
  readonly inputSchema = { type: "object", properties: {}, additionalProperties: false };

  constructor(private readonly query: AllBlueprintsQuery) {}

  async dispatch(): Promise<unknown> {
    const records = await this.query.execute();
    return records.map(toWire);
  }
}
