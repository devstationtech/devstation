import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as ProxmoxConnectionsAllQuery } from "@server/cluster/application/queries/proxmox/connection/all/query.ts";

/**
 * MCP endpoint `devstation_cluster_connections_list` — the Proxmox
 * connection bound to a cluster (zero or one entry). Never throws —
 * returns `[]` when the cluster is missing or unconfigured.
 */
export class ListProxmoxConnectionsMcpEndpoint implements
  Endpoint<
    "devstation_cluster_connections_list",
    { clusterId: string },
    unknown
  > {
  readonly name = "devstation_cluster_connections_list" as const;
  readonly title = "List connection";
  readonly description = "Proxmox connection + provisioning policy of a cluster.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: { clusterId: { type: "string" } },
    required: ["clusterId"],
    additionalProperties: false,
  };

  constructor(private readonly query: ProxmoxConnectionsAllQuery) {}

  async dispatch(args: { clusterId: string }): Promise<unknown> {
    return await this.query.execute(args.clusterId);
  }
}
