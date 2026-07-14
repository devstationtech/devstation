import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationInstallRequest,
  StationInstallResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { InstallStationHandler } from "@server/station/application/handlers/install-station-handler.ts";
import { InstallStation } from "@server/station/application/commands/install-station.ts";

/**
 * Endpoint `station.install` — fire-and-return.
 *
 * Hands the command to `InstallStationHandler`, which starts an Execution and
 * returns its id. The endpoint acknowledges with `{ executionId }`; the UI
 * attaches via `operation.watch(executionId)` to receive `operation.event`
 * notifications (Log/Step/Succeeded/Failed/Cancelled). Cancellation goes
 * through `operation.cancel(executionId)`.
 */
export class InstallStationEndpoint implements
  ProtectedEndpoint<
    "station.install",
    StationInstallRequest,
    StationInstallResponse
  > {
  readonly method = "station.install" as const;

  constructor(private readonly handler: InstallStationHandler) {}

  async dispatch(
    request: StationInstallRequest,
  ): Promise<StationInstallResponse> {
    const executionId = await this.handler.handle(
      new InstallStation(request.stationId, [...request.serviceIds]),
    );
    return { executionId };
  }
}
