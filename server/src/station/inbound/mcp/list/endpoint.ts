import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllStationsQuery } from "@server/station/application/queries/all/query.ts";

/**
 * MCP endpoint `devstation_station_list` — every station with derived
 * status + service stats. Handler-direct.
 */
export class ListStationsMcpEndpoint
  implements Endpoint<"devstation_station_list", Record<string, never>, unknown> {
  readonly name = "devstation_station_list" as const;
  readonly title = "List stations";
  readonly description = "All stations.";
  readonly risk = "read" as const;
  readonly inputSchema = { type: "object", properties: {}, additionalProperties: false };

  constructor(private readonly query: AllStationsQuery) {}

  async dispatch(): Promise<unknown> {
    return await this.query.execute();
  }
}
