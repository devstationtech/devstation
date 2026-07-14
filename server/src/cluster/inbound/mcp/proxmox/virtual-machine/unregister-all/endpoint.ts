import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UnregisterAllVirtualMachinesHandler } from "@server/cluster/application/handlers/proxmox/unregister-all-virtual-machines-handler.ts";
import { UnregisterAllVirtualMachines } from "@server/cluster/application/commands/proxmox/unregister-all-virtual-machines.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  nodeId: string;
};

/**
 * MCP endpoint `devstation_cluster_virtual_machines_unregister_all` — drops every VM
 * from a node. Destructive; policy enforced via the resolved cluster name.
 */
export class UnregisterAllVirtualMachinesMcpEndpoint
  implements
    Endpoint<"devstation_cluster_virtual_machines_unregister_all", Args, Record<string, never>> {
  readonly name = "devstation_cluster_virtual_machines_unregister_all" as const;
  readonly title = "Unregister All VMs";
  readonly description =
    "Drops every VM size from a Proxmox node. Policy enforced via the resolved cluster name.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
    },
    required: ["clusterId", "nodeId"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UnregisterAllVirtualMachinesHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new UnregisterAllVirtualMachines(args.clusterId, args.nodeId),
    );
    return {};
  }
}
