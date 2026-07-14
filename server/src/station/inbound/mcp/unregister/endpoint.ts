import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UnregisterStationHandler } from "@server/station/application/handlers/unregister-station-handler.ts";
import { UnregisterStation } from "@server/station/application/commands/unregister-station.ts";
import type { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

type Args = { stationId: string };

/**
 * MCP endpoint `devstation_station_unregister` — unregisters a station from the
 * catalog. Policy guard resolves the station name via StationByIdQuery and
 * calls `policy.requirePrefix(name)`.
 */
export class UnregisterStationMcpEndpoint
  implements Endpoint<"devstation_station_unregister", Args, Record<string, never>> {
  readonly name = "devstation_station_unregister" as const;
  readonly title = "Unregister station";
  readonly description =
    "Unregisters a station from the catalog; enforces policy prefix on the resolved name.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      stationId: { type: "string" },
    },
    required: ["stationId"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UnregisterStationHandler,
    private readonly stationById: StationByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const station = await this.stationById.execute(args.stationId);
    if (!station) throw new StationNotFound();
    ctx.policy.requirePrefix(station.name);
    await this.handler.handle(new UnregisterStation(args.stationId));
    return {};
  }
}
