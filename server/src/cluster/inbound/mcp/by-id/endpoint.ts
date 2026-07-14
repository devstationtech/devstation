import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

/**
 * MCP endpoint `devstation_cluster_get` — one cluster by id. Throws
 * (registry maps to `isError`) when the id is missing — mirrors the
 * RPC counterpart's behaviour.
 */
// All other cluster MCP tools key on `clusterId` (cluster_unregister,
// cluster_virtual_machine_list, cluster_nodes_*, …). Using `id` here instead would
// force LLMs crossing tools to relearn the arg name. The schema uses
// `clusterId` for consistency; `id` is not accepted.
export class ClusterByIdMcpEndpoint
  implements Endpoint<"devstation_cluster_get", { clusterId: string }, unknown> {
  readonly name = "devstation_cluster_get" as const;
  readonly title = "Get cluster";
  readonly description = "One cluster by id.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: { clusterId: { type: "string" } },
    required: ["clusterId"],
    additionalProperties: false,
  };

  constructor(private readonly query: ClusterByIdQuery) {}

  async dispatch(args: { clusterId: string }): Promise<unknown> {
    const record = await this.query.execute(args.clusterId);
    if (!record) throw new ClusterNotFound(args.clusterId);
    return record;
  }
}
