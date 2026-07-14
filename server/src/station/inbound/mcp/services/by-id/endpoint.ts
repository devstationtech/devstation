import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as ServiceByIdQuery } from "@server/station/application/queries/services/by-id/query.ts";

type Args = { id: string };

/**
 * MCP endpoint `devstation_station_service_get` — service projection for a
 * single id. Throws (registry maps to `isError`) when the id is not found.
 */
export class ServiceByIdMcpEndpoint
  implements Endpoint<"devstation_station_service_get", Args, unknown> {
  readonly name = "devstation_station_service_get" as const;
  readonly title = "Get service";
  readonly description = "One service by id; errors when the id is not found.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
    additionalProperties: false,
  };

  constructor(private readonly query: ServiceByIdQuery) {}

  async dispatch(args: Args): Promise<unknown> {
    const record = await this.query.execute(args.id);
    if (!record) throw new Error(`service '${args.id}' not found.`);
    return record;
  }
}
