import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { StationByIdRequest, StationByIdResponse } from "@jsonrpc-contracts-ts/station.gen.ts";
import type { Query as StationByIdQuery } from "@server/station/application/queries/by-id/query.ts";

/**
 * Endpoint `station.byId` — listing-friendly summary of a single station.
 *
 * The underlying query returns `null` when the id is missing; here we
 * throw so the RPC surface surfaces a clean error to the client (mirrors
 * `cluster.byId`).
 */
export class StationByIdEndpoint implements
  ProtectedEndpoint<
    "station.byId",
    StationByIdRequest,
    StationByIdResponse
  > {
  readonly method = "station.byId" as const;

  constructor(private readonly query: StationByIdQuery) {}

  async dispatch(request: StationByIdRequest): Promise<StationByIdResponse> {
    const record = await this.query.execute(request.id);
    if (!record) throw new Error(`station '${request.id}' not found.`);
    return record;
  }
}
