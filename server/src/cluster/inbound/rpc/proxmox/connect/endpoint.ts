import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxConnectRequest,
  ClusterProxmoxConnectResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { ConnectClusterHandler } from "@server/cluster/application/handlers/proxmox/connect-cluster-handler.ts";
import { ConnectCluster } from "@server/cluster/application/commands/proxmox/connect-cluster.ts";

/**
 * Endpoint `cluster.proxmox.connect` — attaches a Proxmox connection
 * (host + vault credential reference) to a cluster.
 *
 * Thin inbound adapter: hands the command to `ConnectClusterHandler`.
 * Returns an empty Ack on success.
 */
export class ConnectClusterEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.connect",
    ClusterProxmoxConnectRequest,
    ClusterProxmoxConnectResponse
  > {
  readonly method = "cluster.proxmox.connect" as const;

  constructor(private readonly handler: ConnectClusterHandler) {}

  async dispatch(
    request: ClusterProxmoxConnectRequest,
  ): Promise<ClusterProxmoxConnectResponse> {
    await this.handler.handle(
      new ConnectCluster(
        request.clusterId,
        request.host,
        request.vaultId,
        request.secretId,
        request.cloneStrategy,
        request.parallelism,
      ),
    );
    return {};
  }
}
