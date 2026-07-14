import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationRegisterRequest,
  StationRegisterResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { RegisterStationHandler } from "@server/station/application/handlers/register-station-handler.ts";
import { RegisterStation } from "@server/station/application/commands/register-station.ts";

/**
 * Endpoint `station.register` — registers a new station in the catalog.
 *
 * Thin inbound adapter: hands the command to `RegisterStationHandler`.
 * The handler dispatches the StationRegistered domain event after
 * persisting (the dispatcher publishes it on the `stations.v1` topic).
 */
export class RegisterStationEndpoint implements
  ProtectedEndpoint<
    "station.register",
    StationRegisterRequest,
    StationRegisterResponse
  > {
  readonly method = "station.register" as const;

  constructor(private readonly handler: RegisterStationHandler) {}

  async dispatch(
    request: StationRegisterRequest,
  ): Promise<StationRegisterResponse> {
    await this.handler.handle(
      new RegisterStation(
        request.name,
        request.description,
        request.user,
        request.hostname,
      ),
    );
    return {};
  }
}
