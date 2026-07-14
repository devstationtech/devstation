import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { StationListRequest, StationListResponse } from "@jsonrpc-contracts-ts/station.gen.ts";
import type { Query as AllStationsQuery } from "@server/station/application/queries/all/query.ts";

/**
 * Endpoint `station.list` — every station with derived status + service stats.
 */
export class ListStationsEndpoint implements
  ProtectedEndpoint<
    "station.list",
    StationListRequest,
    StationListResponse
  > {
  readonly method = "station.list" as const;

  constructor(private readonly query: AllStationsQuery) {}

  async dispatch(_: StationListRequest): Promise<StationListResponse> {
    return await this.query.execute();
  }
}
