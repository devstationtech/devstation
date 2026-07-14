import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { InstallStationHandler } from "@server/station/application/handlers/install-station-handler.ts";
import { InstallStation } from "@server/station/application/commands/install-station.ts";
import type { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

/**
 * MCP endpoint `devstation_station_install` — long-running mutating.
 * Returns `{ executionId }` immediately; the agent watches via
 * `devstation_execution_watch`.
 *
 * Policy guard: resolves the station's name via `StationByIdQuery`
 * and enforces `policy.requirePrefix(name)` (mirrors the legacy tool
 * — station install uses requirePrefix because there is no allowlist
 * concept for stations, only the prefix gate).
 */
export class InstallStationMcpEndpoint implements
  Endpoint<
    "devstation_station_install",
    { stationId: string; serviceIds: string[] },
    { executionId: string }
  > {
  readonly name = "devstation_station_install" as const;
  readonly title = "Install station";
  readonly description =
    "Installs services of a station — resolves the station name; if a policy is set, enforces it first.";
  readonly risk = "long-running" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      stationId: { type: "string" },
      serviceIds: { type: "array", items: { type: "string" } },
    },
    required: ["stationId", "serviceIds"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: InstallStationHandler,
    private readonly stationById: StationByIdQuery,
  ) {}

  async dispatch(
    args: { stationId: string; serviceIds: string[] },
    ctx: DispatchContext,
  ): Promise<{ executionId: string }> {
    const station = await this.stationById.execute(args.stationId);
    if (!station) throw new StationNotFound();
    ctx.policy.requirePrefix(station.name);
    const executionId = await this.handler.handle(
      new InstallStation(args.stationId, [...args.serviceIds]),
    );
    return { executionId };
  }
}
