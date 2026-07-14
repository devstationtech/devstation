import type { Resource } from "@server/shared/inbound/mcp/resource/resource.ts";
import type { Query as AllServicesQuery } from "@server/station/application/queries/services/all/query.ts";

/**
 * MCP resource `devstation://services` — flattened service projection
 * across every station.
 */
export class ServicesResource implements Resource {
  readonly uri = "devstation://services" as const;
  readonly name = "services" as const;
  readonly description = "All services";

  constructor(private readonly query: AllServicesQuery) {}

  read(): Promise<unknown> {
    return this.query.execute();
  }
}
