import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as ServicesByStationQuery } from "@server/station/application/queries/services/by-station/query.ts";

type Args = { stationId: string };

/**
 * MCP endpoint `devstation_station_services_by_station` — every service that
 * belongs to a given station.
 */
export class ServicesByStationMcpEndpoint
  implements Endpoint<"devstation_station_services_by_station", Args, unknown> {
  readonly name = "devstation_station_services_by_station" as const;
  readonly title = "Services by station";
  readonly description = "All services belonging to a specific station.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      stationId: { type: "string" },
    },
    required: ["stationId"],
    additionalProperties: false,
  };

  constructor(private readonly query: ServicesByStationQuery) {}

  async dispatch(args: Args): Promise<unknown> {
    return await this.query.execute(args.stationId);
  }
}
