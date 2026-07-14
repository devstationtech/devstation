import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as VirtualMachineByImageQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/by-image/query.ts";

/**
 * MCP endpoint `devstation_cluster_virtual_machine_by_image` — every VM currently
 * associated to the given image id, across clusters and nodes.
 *
 * Read-only; never throws.
 */
export class VirtualMachineByImageMcpEndpoint
  implements Endpoint<"devstation_cluster_virtual_machine_by_image", { imageId: string }, unknown> {
  readonly name = "devstation_cluster_virtual_machine_by_image" as const;
  readonly title = "VMs by Image";
  readonly description =
    "Every VM currently associated to the given image id, across clusters and nodes. Never throws.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      imageId: { type: "string" },
    },
    required: ["imageId"],
    additionalProperties: false,
  };

  constructor(private readonly query: VirtualMachineByImageQuery) {}

  async dispatch(args: { imageId: string }): Promise<unknown> {
    return await this.query.execute(args.imageId);
  }
}
