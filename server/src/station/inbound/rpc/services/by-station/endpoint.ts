import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationServicesByStationRequest,
  StationServicesByStationResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { Query as ServicesByStationQuery } from "@server/station/application/queries/services/by-station/query.ts";

/**
 * Endpoint `station.services.byStation` — every service that belongs to a
 * given station.
 */
export class ServicesByStationEndpoint implements
  ProtectedEndpoint<
    "station.services.byStation",
    StationServicesByStationRequest,
    StationServicesByStationResponse
  > {
  readonly method = "station.services.byStation" as const;

  constructor(private readonly query: ServicesByStationQuery) {}

  async dispatch(
    request: StationServicesByStationRequest,
  ): Promise<StationServicesByStationResponse> {
    return await this.query.execute(request.stationId);
  }
}
