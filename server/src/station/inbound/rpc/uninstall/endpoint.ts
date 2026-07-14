import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationUninstallRequest,
  StationUninstallResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { UninstallStationHandler } from "@server/station/application/handlers/uninstall-station-handler.ts";
import { UninstallStation } from "@server/station/application/commands/uninstall-station.ts";

/**
 * Endpoint `station.uninstall` — fire-and-return, mirror of `station.install`.
 *
 * Hands the command to `UninstallStationHandler`, which starts an Execution and
 * returns its id. The UI attaches via `execution.watch(executionId)`.
 */
export class UninstallStationEndpoint implements
  ProtectedEndpoint<
    "station.uninstall",
    StationUninstallRequest,
    StationUninstallResponse
  > {
  readonly method = "station.uninstall" as const;

  constructor(private readonly handler: UninstallStationHandler) {}

  async dispatch(
    request: StationUninstallRequest,
  ): Promise<StationUninstallResponse> {
    const executionId = await this.handler.handle(
      new UninstallStation(request.stationId, [...request.serviceIds]),
    );
    return { executionId };
  }
}
