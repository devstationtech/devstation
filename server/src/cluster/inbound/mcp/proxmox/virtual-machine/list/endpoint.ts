import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as AllVirtualMachinesQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/all/query.ts";

/**
 * MCP endpoint `devstation_cluster_virtual_machine_list` — VMs registered on a node,
 * enriched with size/image names and optional live resources.
 *
 * Uses `executeOrThrow` so a missing cluster/node surfaces as an MCP
 * error with a remediation hint, rather than returning `[]` for both
 * "node has no VMs" and "wrong id."
 */
export class ListProxmoxVirtualMachinesMcpEndpoint implements
  Endpoint<
    "devstation_cluster_virtual_machine_list",
    { clusterId: string; nodeId: string },
    unknown
  > {
  readonly name = "devstation_cluster_virtual_machine_list" as const;
  readonly title = "List VMs";
  readonly description = "VMs registered on a Proxmox node (enriched). Throws when the cluster " +
    "or node id is unknown — discover ids via devstation_cluster_list and " +
    "devstation_cluster_nodes_list.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: { clusterId: { type: "string" }, nodeId: { type: "string" } },
    required: ["clusterId", "nodeId"],
    additionalProperties: false,
  };

  constructor(private readonly query: AllVirtualMachinesQuery) {}

  async dispatch(args: { clusterId: string; nodeId: string }): Promise<unknown> {
    return await this.query.executeOrThrow(args.clusterId, args.nodeId);
  }
}
