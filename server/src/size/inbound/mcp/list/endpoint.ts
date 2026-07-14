import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllSizesQuery } from "@server/size/application/queries/all/query.ts";

/**
 * MCP endpoint `devstation_size_list` — all VM hardware sizes.
 * Query-direct counterpart of `size.list` RPC.
 */
export class ListSizesMcpEndpoint
  implements Endpoint<"devstation_size_list", Record<string, never>, unknown> {
  readonly name = "devstation_size_list" as const;
  readonly title = "List sizes";
  readonly description = "All registered VM hardware sizes.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  constructor(private readonly query: AllSizesQuery) {}

  async dispatch(): Promise<unknown> {
    return await this.query.execute();
  }
}
