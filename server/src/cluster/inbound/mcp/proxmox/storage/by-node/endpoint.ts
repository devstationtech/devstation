import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as StoragesByNodeQuery } from "@server/cluster/application/queries/proxmox/storage/by-node/query.ts";

type Args = {
  clusterId: string;
  nodeId: string;
};

/**
 * MCP endpoint `devstation_cluster_storage_by_node` — live storages of a
 * single Proxmox node. Returns `{ connected: false, storages: [] }` when
 * the cluster/node/connection/API is unreachable. Read-only; never throws.
 */
export class StorageByNodeMcpEndpoint
  implements Endpoint<"devstation_cluster_storage_by_node", Args, unknown> {
  readonly name = "devstation_cluster_storage_by_node" as const;
  readonly title = "Storage by Node";
  readonly description =
    "Live storages of a single Proxmox node. Returns { connected: false, storages: [] } when unreachable. Never throws.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
    },
    required: ["clusterId", "nodeId"],
    additionalProperties: false,
  };

  constructor(private readonly query: StoragesByNodeQuery) {}

  async dispatch(args: Args): Promise<unknown> {
    return await this.query.execute(args.clusterId, args.nodeId);
  }
}
