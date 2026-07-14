import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";

/**
 * MCP endpoint `devstation_station_get` — one station by id. Throws
 * (registry maps to `isError`) when missing — mirrors the RPC
 * counterpart's behaviour.
 */
export class StationByIdMcpEndpoint
  implements Endpoint<"devstation_station_get", { id: string }, unknown> {
  readonly name = "devstation_station_get" as const;
  readonly title = "Get station";
  readonly description = "One station by id.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  };

  constructor(private readonly query: StationByIdQuery) {}

  async dispatch(args: { id: string }): Promise<unknown> {
    const record = await this.query.execute(args.id);
    if (!record) throw new Error(`station '${args.id}' not found.`);
    return record;
  }
}
