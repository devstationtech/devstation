import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  BlueprintListRequest,
  BlueprintListResponse,
} from "@jsonrpc-contracts-ts/blueprint.gen.ts";
import type { Query as AllBlueprintsQuery } from "@server/blueprint/application/queries/all/query.ts";
import { toWire } from "@server/blueprint/inbound/rpc/to-wire.ts";

/**
 * Endpoint `blueprint.list` — every blueprint in the catalog.
 *
 * Read-only: the catalog is parsed from `<root>/<name>/blueprint.yaml`.
 * Thin inbound boundary over the existing query; `toWire` renames the
 * declared-input `default` field to `value` for the contract.
 */
export class ListBlueprintsEndpoint implements
  ProtectedEndpoint<
    "blueprint.list",
    BlueprintListRequest,
    BlueprintListResponse
  > {
  readonly method = "blueprint.list" as const;

  constructor(private readonly query: AllBlueprintsQuery) {}

  async dispatch(_: BlueprintListRequest): Promise<BlueprintListResponse> {
    const records = await this.query.execute();
    return records.map(toWire);
  }
}
