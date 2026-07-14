import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationInstancesListRequest,
  StationInstancesListResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { Query as AllInstancesQuery } from "@server/station/application/queries/instances/all/query.ts";

/**
 * Endpoint `station.instances.list` — cross-provider VMs annotated with
 * occupancy info from the Service domain.
 */
export class ListInstancesEndpoint implements
  ProtectedEndpoint<
    "station.instances.list",
    StationInstancesListRequest,
    StationInstancesListResponse
  > {
  readonly method = "station.instances.list" as const;

  constructor(private readonly query: AllInstancesQuery) {}

  async dispatch(_: StationInstancesListRequest): Promise<StationInstancesListResponse> {
    return await this.query.execute();
  }
}
