import type { Resource } from "@server/shared/inbound/mcp/resource/resource.ts";
import type { Query as AllClustersQuery } from "@server/cluster/application/queries/all/query.ts";

/**
 * MCP resource `devstation://clusters` — every cluster as JSON. Read-
 * only counterpart to `devstation_cluster_list` (same query).
 */
export class ClustersResource implements Resource {
  readonly uri = "devstation://clusters" as const;
  readonly name = "clusters" as const;
  readonly description = "All clusters";

  constructor(private readonly query: AllClustersQuery) {}

  read(): Promise<unknown> {
    return this.query.execute();
  }
}
