import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as BlueprintByIdQuery } from "@server/blueprint/application/queries/by-id/query.ts";
import { toWire } from "@server/blueprint/inbound/rpc/to-wire.ts";

type Args = {
  id: string;
};

/**
 * MCP endpoint `devstation_blueprint_get` — a single blueprint by id
 * (== name). Query-direct counterpart of `blueprint.byId` RPC
 * Throws when the blueprint is not found (same
 * behaviour as the RPC endpoint).
 */
export class BlueprintByIdMcpEndpoint
  implements Endpoint<"devstation_blueprint_get", Args, unknown> {
  readonly name = "devstation_blueprint_get" as const;
  readonly title = "Get blueprint";
  readonly description = "Returns a single blueprint by id (== name). Throws when not found.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
    additionalProperties: false,
  };

  constructor(private readonly query: BlueprintByIdQuery) {}

  async dispatch(args: Args): Promise<unknown> {
    const record = await this.query.execute(args.id);
    if (!record) throw new Error(`blueprint '${args.id}' not found.`);
    return toWire(record);
  }
}
