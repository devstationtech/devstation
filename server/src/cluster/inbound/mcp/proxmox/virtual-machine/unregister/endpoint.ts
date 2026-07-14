import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UnregisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/unregister-virtual-machine-handler.ts";
import { UnregisterVirtualMachine } from "@server/cluster/application/commands/proxmox/unregister-virtual-machine.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  nodeId: string;
  id: number;
};

/**
 * MCP endpoint `devstation_cluster_virtual_machine_unregister` — drops a single VM from
 * a node. Destructive; policy enforced via the resolved cluster name.
 */
export class UnregisterVirtualMachineMcpEndpoint
  implements
    Endpoint<"devstation_cluster_virtual_machine_unregister", Args, Record<string, never>> {
  readonly name = "devstation_cluster_virtual_machine_unregister" as const;
  readonly title = "Unregister VM";
  readonly description =
    "Drops a single VM size from a Proxmox node. Policy enforced via the resolved cluster name.";
  readonly risk = "destructive" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
      id: { type: "number" },
    },
    required: ["clusterId", "nodeId", "id"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UnregisterVirtualMachineHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new UnregisterVirtualMachine(args.clusterId, args.nodeId, args.id),
    );
    return {};
  }
}
