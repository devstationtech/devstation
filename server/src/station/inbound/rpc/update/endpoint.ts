import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationUpdateRequest,
  StationUpdateResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { UpdateStationHandler } from "@server/station/application/handlers/update-station-handler.ts";
import { UpdateStation } from "@server/station/application/commands/update-station.ts";

/**
 * Endpoint `station.update` — replaces the mutable metadata (name,
 * description) of an existing station.
 */
export class UpdateStationEndpoint implements
  ProtectedEndpoint<
    "station.update",
    StationUpdateRequest,
    StationUpdateResponse
  > {
  readonly method = "station.update" as const;

  constructor(private readonly handler: UpdateStationHandler) {}

  async dispatch(
    request: StationUpdateRequest,
  ): Promise<StationUpdateResponse> {
    await this.handler.handle(
      new UpdateStation(request.stationId, request.name, request.description),
    );
    return {};
  }
}
