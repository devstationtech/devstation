import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllVirtualMachineTagsQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/tags/all/query.ts";

/**
 * MCP endpoint `devstation_cluster_virtual_machine_tags` — distinct VM tags in use
 * across every cluster with usage count (reuse suggestions).
 */
export class ListVirtualMachineTagsMcpEndpoint
  implements Endpoint<"devstation_cluster_virtual_machine_tags", Record<string, never>, unknown> {
  readonly name = "devstation_cluster_virtual_machine_tags" as const;
  readonly title = "Distinct VM tags";
  readonly description = "Distinct VM tags in use across clusters (reuse suggestions).";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  constructor(private readonly query: AllVirtualMachineTagsQuery) {}

  async dispatch(): Promise<unknown> {
    return { tags: await this.query.execute() };
  }
}
