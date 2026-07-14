import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllInstancesQuery } from "@server/station/application/queries/instances/all/query.ts";

/**
 * MCP endpoint `devstation_station_instances_list` — cross-provider
 * VMs annotated with occupancy info from the Service domain.
 */
export class ListInstancesMcpEndpoint
  implements Endpoint<"devstation_station_instances_list", Record<string, never>, unknown> {
  readonly name = "devstation_station_instances_list" as const;
  readonly title = "List instances";
  readonly description = "Instances across stations.";
  readonly risk = "read" as const;
  readonly inputSchema = { type: "object", properties: {}, additionalProperties: false };

  constructor(private readonly query: AllInstancesQuery) {}

  async dispatch(): Promise<unknown> {
    return await this.query.execute();
  }
}
