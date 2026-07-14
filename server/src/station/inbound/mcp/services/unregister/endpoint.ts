import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UnregisterServiceHandler } from "@server/station/application/handlers/unregister-service-handler.ts";
import { UnregisterService } from "@server/station/application/commands/unregister-service.ts";
import type { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

type Args = { stationId: string; serviceId: string };

/**
 * MCP endpoint `devstation_station_service_unregister` — unregisters a service from a
 * station. Policy guard resolves the station name via StationByIdQuery and
 * calls `policy.requirePrefix(name)`.
 */
export class UnregisterServiceMcpEndpoint
  implements Endpoint<"devstation_station_service_unregister", Args, Record<string, never>> {
  readonly name = "devstation_station_service_unregister" as const;
  readonly title = "Unregister service";
  readonly description =
    "Unregisters a service from a station; enforces policy prefix on the resolved station name.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      stationId: { type: "string" },
      serviceId: { type: "string" },
    },
    required: ["stationId", "serviceId"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UnregisterServiceHandler,
    private readonly stationById: StationByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const station = await this.stationById.execute(args.stationId);
    if (!station) throw new StationNotFound();
    ctx.policy.requirePrefix(station.name);
    await this.handler.handle(new UnregisterService(args.stationId, args.serviceId));
    return {};
  }
}
