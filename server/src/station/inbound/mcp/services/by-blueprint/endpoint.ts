import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as ServicesByBlueprintQuery } from "@server/station/application/queries/services/by-blueprint/query.ts";

type Args = { blueprint: string };

/**
 * MCP endpoint `devstation_station_services_by_blueprint` — services filtered
 * by blueprint name. Used by the hosted-blueprint register flow.
 */
export class ServicesByBlueprintMcpEndpoint
  implements Endpoint<"devstation_station_services_by_blueprint", Args, unknown> {
  readonly name = "devstation_station_services_by_blueprint" as const;
  readonly title = "Services by blueprint";
  readonly description = "Services filtered by blueprint name across all stations.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      blueprint: { type: "string" },
    },
    required: ["blueprint"],
    additionalProperties: false,
  };

  constructor(private readonly query: ServicesByBlueprintQuery) {}

  async dispatch(args: Args): Promise<unknown> {
    return await this.query.execute(args.blueprint);
  }
}
