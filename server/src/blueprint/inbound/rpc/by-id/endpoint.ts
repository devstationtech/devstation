import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  BlueprintByIdRequest,
  BlueprintByIdResponse,
} from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import type { Query as BlueprintByIdQuery } from "@server/blueprint/application/queries/by-id/query.ts";
import { toWire } from "@server/blueprint/inbound/rpc/to-wire.ts";

/**
 * Endpoint `blueprint.byId` — a single blueprint by id (== name).
 *
 * The underlying query returns `null` when the blueprint is missing;
 * here we throw so the RPC surface returns a clean error (mirrors
 * `station.byId` / `cluster.byId`).
 */
export class BlueprintByIdEndpoint implements
  ProtectedEndpoint<
    "blueprint.byId",
    BlueprintByIdRequest,
    BlueprintByIdResponse
  > {
  readonly method = "blueprint.byId" as const;

  constructor(private readonly query: BlueprintByIdQuery) {}

  async dispatch(request: BlueprintByIdRequest): Promise<BlueprintByIdResponse> {
    const record = await this.query.execute(request.id);
    if (!record) throw new Error(`blueprint '${request.id}' not found.`);
    return toWire(record);
  }
}
