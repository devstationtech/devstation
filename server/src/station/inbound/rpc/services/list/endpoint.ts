import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationServicesListRequest,
  StationServicesListResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { Query as AllServicesQuery } from "@server/station/application/queries/services/all/query.ts";

/**
 * Endpoint `station.services.list` — flattened service projection across
 * every station with provider/cluster/node enrichment per instance.
 */
export class ListServicesEndpoint implements
  ProtectedEndpoint<
    "station.services.list",
    StationServicesListRequest,
    StationServicesListResponse
  > {
  readonly method = "station.services.list" as const;

  constructor(private readonly query: AllServicesQuery) {}

  async dispatch(_: StationServicesListRequest): Promise<StationServicesListResponse> {
    return await this.query.execute();
  }
}
