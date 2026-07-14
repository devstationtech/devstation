import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationUnregisterRequest,
  StationUnregisterResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { UnregisterStationHandler } from "@server/station/application/handlers/unregister-station-handler.ts";
import { UnregisterStation } from "@server/station/application/commands/unregister-station.ts";

/**
 * Endpoint `station.unregister` — unregisters a station from the catalog.
 */
export class UnregisterStationEndpoint implements
  ProtectedEndpoint<
    "station.unregister",
    StationUnregisterRequest,
    StationUnregisterResponse
  > {
  readonly method = "station.unregister" as const;

  constructor(private readonly handler: UnregisterStationHandler) {}

  async dispatch(
    request: StationUnregisterRequest,
  ): Promise<StationUnregisterResponse> {
    await this.handler.handle(new UnregisterStation(request.stationId));
    return {};
  }
}
