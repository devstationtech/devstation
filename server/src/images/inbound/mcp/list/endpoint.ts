import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllImagesQuery } from "@server/images/application/queries/all/query.ts";

/**
 * MCP endpoint `devstation_image_list` — the whole image catalog.
 * Query-direct counterpart of `image.list` RPC.
 */
export class ListImagesMcpEndpoint
  implements Endpoint<"devstation_image_list", Record<string, never>, unknown> {
  readonly name = "devstation_image_list" as const;
  readonly title = "List images";
  readonly description = "Every OS image in the catalog.";
  readonly risk = "read" as const;
  readonly inputSchema = { type: "object", properties: {}, additionalProperties: false };

  constructor(private readonly query: AllImagesQuery) {}

  async dispatch(): Promise<unknown> {
    return await this.query.execute();
  }
}
