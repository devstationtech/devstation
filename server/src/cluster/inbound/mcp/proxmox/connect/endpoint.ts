import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { DispatchContext } from "@server/shared/inbound/mcp/endpoint/dispatch-context.ts";
import type { ConnectClusterHandler } from "@server/cluster/application/handlers/proxmox/connect-cluster-handler.ts";
import { ConnectCluster } from "@server/cluster/application/commands/proxmox/connect-cluster.ts";
import type { Query as ClusterByIdQuery } from "@server/cluster/application/queries/by-id/query.ts";
import { ClusterNotFound } from "@server/cluster/domain/exceptions/cluster-not-found.ts";

type Args = {
  clusterId: string;
  host: string;
  vaultId: string;
  secretId: string;
  cloneStrategy?: string;
  parallelism?: number;
  /** Accepted for forward compat — see test-connection endpoint (B2). */
  skipTlsVerification?: boolean;
};

/**
 * MCP endpoint `devstation_cluster_connect` — attaches a Proxmox
 * connection (host + vault credential reference) to a cluster.
 * MCP-port counterpart of `cluster.proxmox.connect`; consumes the
 * same handler.
 *
 * Mutating; policy enforced via the resolved cluster name.
 */
export class ConnectClusterMcpEndpoint
  implements Endpoint<"devstation_cluster_connect", Args, Record<string, never>> {
  readonly name = "devstation_cluster_connect" as const;
  readonly title = "Connect Proxmox cluster";
  readonly description = "Attaches a Proxmox connection (host + vault credential reference) " +
    "to an existing cluster. Optionally sets the clone strategy and " +
    "provisioning parallelism. Policy enforced via the resolved cluster name.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      host: { type: "string" },
      vaultId: { type: "string" },
      secretId: { type: "string" },
      cloneStrategy: { type: "string" },
      parallelism: { type: "number" },
      skipTlsVerification: {
        type: "boolean",
        description: "Accepted for backwards compatibility — no-op; the engine " +
          "bypasses certificate validation unconditionally.",
      },
    },
    required: ["clusterId", "host", "vaultId", "secretId"],
    additionalProperties: false,
  };

  constructor(
    private readonly handler: ConnectClusterHandler,
    private readonly clusterById: ClusterByIdQuery,
  ) {}

  async dispatch(args: Args, ctx: DispatchContext): Promise<Record<string, never>> {
    const cluster = await this.clusterById.execute(args.clusterId);
    if (!cluster) throw new ClusterNotFound(args.clusterId);
    ctx.policy.requireMutableCluster(cluster.name);
    await this.handler.handle(
      new ConnectCluster(
        args.clusterId,
        args.host,
        args.vaultId,
        args.secretId,
        args.cloneStrategy,
        args.parallelism,
      ),
    );
    return {};
  }
}
