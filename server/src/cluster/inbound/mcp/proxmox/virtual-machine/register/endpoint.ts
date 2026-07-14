import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { RegisterVirtualMachineHandler } from "@server/cluster/application/handlers/proxmox/register-virtual-machine-handler.ts";
import { RegisterVirtualMachine } from "@server/cluster/application/commands/proxmox/register-virtual-machine.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  nodeId: string;
  name: string;
  id: number;
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
 * MCP endpoint `devstation_cluster_virtual_machine_register` — adds a virtual-machine
 * size to a node. MCP-port counterpart of `cluster.proxmox.virtualMachine.
 * register`; consumes the same handler.
 *
 * Requires the image to be assigned to the node first; rejects on
 * duplicate virtualMachineId or conflicting IP. Mutating; policy enforced via the
 * resolved cluster name.
 */
export class RegisterVirtualMachineMcpEndpoint
  implements Endpoint<"devstation_cluster_virtual_machine_register", Args, Record<string, never>> {
  readonly name = "devstation_cluster_virtual_machine_register" as const;
  readonly title = "Register VM";
  readonly description = "Adds a virtual-machine size to a Proxmox node. The image must " +
    "already be assigned to the node; rejects on duplicate virtualMachineId or " +
    "conflicting IP. Policy enforced via the resolved cluster name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
      name: { type: "string" },
      id: { type: "number" },
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
      "name",
      "id",
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
    private readonly handler: RegisterVirtualMachineHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new RegisterVirtualMachine(
        args.clusterId,
        args.nodeId,
        args.name,
        args.id,
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
