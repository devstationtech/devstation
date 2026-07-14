import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UpdateStationHandler } from "@server/station/application/handlers/update-station-handler.ts";
import { UpdateStation } from "@server/station/application/commands/update-station.ts";
import type { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

type Args = {
  stationId: string;
  name: string;
  description: string;
};

/**
 * MCP endpoint `devstation_station_update` — replaces the mutable metadata
 * (name, description) of an existing station. Policy guard resolves the
 * station name via StationByIdQuery and calls `policy.requirePrefix(name)`.
 */
export class UpdateStationMcpEndpoint
  implements Endpoint<"devstation_station_update", Args, Record<string, never>> {
  readonly name = "devstation_station_update" as const;
  readonly title = "Update station";
  readonly description =
    "Replaces the name and description of a station; enforces policy prefix on the resolved name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      stationId: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
    },
    required: ["stationId", "name", "description"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UpdateStationHandler,
    private readonly stationById: StationByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const station = await this.stationById.execute(args.stationId);
    if (!station) throw new StationNotFound();
    ctx.policy.requirePrefix(station.name);
    await this.handler.handle(
      new UpdateStation(args.stationId, args.name, args.description),
    );
    return {};
  }
}
