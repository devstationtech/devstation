import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationServicesByIdRequest,
  StationServicesByIdResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { Query as ServiceByIdQuery } from "@server/station/application/queries/services/by-id/query.ts";

/**
 * Endpoint `station.services.byId` — service projection for a single id.
 *
 * The underlying query returns `null` when the id is missing across every
 * station; here we throw so the RPC surface surfaces a clean error to the
 * client (mirrors `station.byId` and `cluster.byId`).
 */
export class ServiceByIdEndpoint implements
  ProtectedEndpoint<
    "station.services.byId",
    StationServicesByIdRequest,
    StationServicesByIdResponse
  > {
  readonly method = "station.services.byId" as const;

  constructor(private readonly query: ServiceByIdQuery) {}

  async dispatch(
    request: StationServicesByIdRequest,
  ): Promise<StationServicesByIdResponse> {
    const record = await this.query.execute(request.id);
    if (!record) throw new Error(`service '${request.id}' not found.`);
    return record;
  }
}
