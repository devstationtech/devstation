import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as ProvisionQuery } from "@server/cluster/application/queries/proxmox/provision/query.ts";

/**
 * MCP endpoint `devstation_cluster_provision_preview` — provisioning
 * topology preview (nodes + VMs + images). Throws when the cluster id
 * is missing — registry maps to `isError`.
 */
export class ProvisionPreviewMcpEndpoint implements
  Endpoint<
    "devstation_cluster_provision_preview",
    { clusterId: string },
    unknown
  > {
  readonly name = "devstation_cluster_provision_preview" as const;
  readonly title = "Provision preview";
  readonly description = "Provisioning topology preview for a cluster (nodes + VMs + images).";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: { clusterId: { type: "string" } },
    required: ["clusterId"],
    additionalProperties: false,
  };

  constructor(private readonly query: ProvisionQuery) {}

  async dispatch(args: { clusterId: string }): Promise<unknown> {
    const record = await this.query.execute(args.clusterId);
    if (!record) throw new Error(`cluster '${args.clusterId}' not found.`);
    return record;
  }
}
