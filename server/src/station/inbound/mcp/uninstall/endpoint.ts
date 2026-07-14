import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UninstallStationHandler } from "@server/station/application/handlers/uninstall-station-handler.ts";
import { UninstallStation } from "@server/station/application/commands/uninstall-station.ts";
import type { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";
import { StationNotFound } from "@server/station/domain/exceptions/station-not-found.ts";

/**
 * MCP endpoint `devstation_station_uninstall` — long-running, destructive.
 * Returns `{ executionId }` immediately; the agent watches via
 * `devstation_execution_watch`. Token-gated by `stations:write` (registered
 * in mcp.ts) and policy-gated by `requirePrefix` like `station_install`.
 */
export class UninstallStationMcpEndpoint implements
  Endpoint<
    "devstation_station_uninstall",
    { stationId: string; serviceIds: string[] },
    { executionId: string }
  > {
  readonly name = "devstation_station_uninstall" as const;
  readonly title = "Uninstall station services";
  readonly description =
    "Tears down services of a station (runs their blueprint uninstall steps) — resolves the station name; if a policy is set, enforces it first.";
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
    private readonly handler: UninstallStationHandler,
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
      new UninstallStation(args.stationId, [...args.serviceIds]),
    );
    return { executionId };
  }
}
