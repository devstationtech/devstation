import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxDisconnectRequest,
  ClusterProxmoxDisconnectResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { DisconnectClusterHandler } from "@server/cluster/application/handlers/proxmox/disconnect-cluster-handler.ts";
import { DisconnectCluster } from "@server/cluster/application/commands/proxmox/disconnect-cluster.ts";

/**
 * Endpoint `cluster.proxmox.disconnect` — clears the connection bound to
 * a Proxmox cluster.
 *
 * Thin inbound adapter: hands the command to `DisconnectClusterHandler`.
 * Returns an empty Ack on success.
 */
export class DisconnectClusterEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.disconnect",
    ClusterProxmoxDisconnectRequest,
    ClusterProxmoxDisconnectResponse
  > {
  readonly method = "cluster.proxmox.disconnect" as const;

  constructor(private readonly handler: DisconnectClusterHandler) {}

  async dispatch(
    request: ClusterProxmoxDisconnectRequest,
  ): Promise<ClusterProxmoxDisconnectResponse> {
    await this.handler.handle(new DisconnectCluster(request.clusterId));
    return {};
  }
}
