import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationServicesByBlueprintRequest,
  StationServicesByBlueprintResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { Query as ServicesByBlueprintQuery } from "@server/station/application/queries/services/by-blueprint/query.ts";

/**
 * Endpoint `station.services.byBlueprint` — services filtered by blueprint
 * name. Used by the hosted-blueprint register flow.
 */
export class ServicesByBlueprintEndpoint implements
  ProtectedEndpoint<
    "station.services.byBlueprint",
    StationServicesByBlueprintRequest,
    StationServicesByBlueprintResponse
  > {
  readonly method = "station.services.byBlueprint" as const;

  constructor(private readonly query: ServicesByBlueprintQuery) {}

  async dispatch(
    request: StationServicesByBlueprintRequest,
  ): Promise<StationServicesByBlueprintResponse> {
    return await this.query.execute(request.blueprint);
  }
}
