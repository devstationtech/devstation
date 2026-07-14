import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { UpdateVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/update-virtual-machine-handler.ts";
import { UpdateVirtualMachine } from "@server/cluster/application/commands/proxmox/update-virtual-machine.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  nodeId: string;
  id: number;
  name: string;
  size: string;
  image: string;
  ip: string;
  gateway: string;
  dns: string;
  storage: string;
  cpu: number;
  ram: number;
  disk: number;
  credentialVaultId: string;
  usernameSecretId: string;
  passwordSecretId: string;
  tags?: string[];
};

/**
 * MCP endpoint `devstation_cluster_virtual_machine_update` — replaces the mutable
 * fields of an existing VM size on a node.
 *
 * Mutating; policy enforced via the resolved cluster name.
 */
export class UpdateVirtualMachineMcpEndpoint
  implements Endpoint<"devstation_cluster_virtual_machine_update", Args, Record<string, never>> {
  readonly name = "devstation_cluster_virtual_machine_update" as const;
  readonly title = "Update VM";
  readonly description =
    "Replaces the mutable fields of an existing VM size on a Proxmox node. Policy enforced via the resolved cluster name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
      id: { type: "number" },
      name: { type: "string" },
      size: { type: "string" },
      image: { type: "string" },
      ip: { type: "string" },
      gateway: { type: "string" },
      dns: { type: "string" },
      storage: { type: "string" },
      cpu: { type: "number" },
      ram: { type: "number" },
      disk: { type: "number" },
      credentialVaultId: { type: "string" },
      usernameSecretId: { type: "string" },
      passwordSecretId: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: [
      "clusterId",
      "nodeId",
      "id",
      "name",
      "size",
      "image",
      "ip",
      "gateway",
      "dns",
      "storage",
      "cpu",
      "ram",
      "disk",
      "credentialVaultId",
      "usernameSecretId",
      "passwordSecretId",
    ],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: UpdateVirtualMachineHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new UpdateVirtualMachine(
        args.clusterId,
        args.nodeId,
        args.id,
        args.name,
        args.size,
        args.image,
        args.ip,
        args.gateway,
        args.dns,
        args.storage,
        args.cpu,
        args.ram,
        args.disk,
        args.credentialVaultId,
        args.usernameSecretId,
        args.passwordSecretId,
        args.tags ?? [],
      ),
    );
    return {};
  }
}
