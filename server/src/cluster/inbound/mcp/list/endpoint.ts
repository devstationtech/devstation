import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllClustersQuery } from "@server/cluster/application/queries/all/query.ts";

/**
 * MCP endpoint `devstation_cluster_list` — every cluster with its
 * topology summary. Thin adapter: calls `AllClustersQuery` directly
 * (handler-direct, no RPC indirection).
 *
 * Parallel to `cluster/inbound/rpc/list/endpoint.ts` (RPC same op).
 */
export class ListClustersMcpEndpoint
  implements Endpoint<"devstation_cluster_list", Record<string, never>, unknown> {
  readonly name = "devstation_cluster_list" as const;
  readonly title = "List clusters";
  readonly description = "All clusters with topology summary.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  constructor(private readonly query: AllClustersQuery) {}

  async dispatch(): Promise<unknown> {
    return await this.query.execute();
  }
}
