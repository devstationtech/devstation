import type { Resource } from "@server/shared/inbound/mcp/resource/resource.ts";
import type { Query as AllStationsQuery } from "@server/station/application/queries/all/query.ts";

/**
 * MCP resource `devstation://stations` — every station as JSON. Read-
 * only counterpart to `devstation_station_list`.
 */
export class StationsResource implements Resource {
  readonly uri = "devstation://stations" as const;
  readonly name = "stations" as const;
  readonly description = "All stations";

  constructor(private readonly query: AllStationsQuery) {}

  read(): Promise<unknown> {
    return this.query.execute();
  }
}
