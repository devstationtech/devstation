import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllServicesQuery } from "@server/station/application/queries/services/all/query.ts";

/**
 * MCP endpoint `devstation_station_services_list` — flattened service
 * projection across every station, with provider/cluster/node
 * enrichment per instance.
 */
export class ListServicesMcpEndpoint
  implements Endpoint<"devstation_station_services_list", Record<string, never>, unknown> {
  readonly name = "devstation_station_services_list" as const;
  readonly title = "List services";
  readonly description = "Services across stations.";
  readonly risk = "read" as const;
  readonly inputSchema = { type: "object", properties: {}, additionalProperties: false };

  constructor(private readonly query: AllServicesQuery) {}

  async dispatch(): Promise<unknown> {
    return await this.query.execute();
  }
}
