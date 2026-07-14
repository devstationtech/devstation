import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationServicesUnregisterRequest,
  StationServicesUnregisterResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { UnregisterServiceHandler } from "@server/station/application/handlers/unregister-service-handler.ts";
import { UnregisterService } from "@server/station/application/commands/unregister-service.ts";

/**
 * Endpoint `station.services.unregister` — unregisters a service from a station.
 */
export class UnregisterServiceEndpoint implements
  ProtectedEndpoint<
    "station.services.unregister",
    StationServicesUnregisterRequest,
    StationServicesUnregisterResponse
  > {
  readonly method = "station.services.unregister" as const;

  constructor(private readonly handler: UnregisterServiceHandler) {}

  async dispatch(
    request: StationServicesUnregisterRequest,
  ): Promise<StationServicesUnregisterResponse> {
    await this.handler.handle(
      new UnregisterService(request.stationId, request.serviceId),
    );
    return {};
  }
}
