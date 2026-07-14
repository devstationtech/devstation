import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllNodesQuery } from "@server/cluster/application/queries/proxmox/node/all/query.ts";

/**
 * MCP endpoint `devstation_cluster_nodes_list` — node rows for a cluster.
 * Merges catalog info with live Proxmox API snapshots when reachable.
 * Never throws (offline = entries without live resources).
 */
export class ListProxmoxNodesMcpEndpoint
  implements Endpoint<"devstation_cluster_nodes_list", { clusterId: string }, unknown> {
  readonly name = "devstation_cluster_nodes_list" as const;
  readonly title = "List Proxmox nodes";
  readonly description = "Nodes of a Proxmox cluster.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: { clusterId: { type: "string" } },
    required: ["clusterId"],
    additionalProperties: false,
  };

  constructor(private readonly query: AllNodesQuery) {}

  async dispatch(args: { clusterId: string }): Promise<unknown> {
    return await this.query.execute(args.clusterId);
  }
}
