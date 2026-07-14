import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as ImagesAllQuery } from "@server/cluster/application/queries/images/all/query.ts";

/**
 * MCP endpoint `devstation_cluster_images_list` — every registered
 * image (with assignment slots + active VM count). Optionally filtered
 * by cluster id.
 */
export class ListImagesMcpEndpoint implements
  Endpoint<
    "devstation_cluster_images_list",
    { clusterId?: string },
    unknown
  > {
  readonly name = "devstation_cluster_images_list" as const;
  readonly title = "List images";
  readonly description = "Image catalog (optionally filtered by cluster).";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: { clusterId: { type: "string" } },
    additionalProperties: false,
  };

  constructor(private readonly query: ImagesAllQuery) {}

  async dispatch(args: { clusterId?: string }): Promise<unknown> {
    return await this.query.execute(args.clusterId ?? undefined);
  }
}
