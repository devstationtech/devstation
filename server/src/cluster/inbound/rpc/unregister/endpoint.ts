import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterUnregisterRequest,
  ClusterUnregisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { UnregisterClusterHandler } from "@server/cluster/application/handlers/proxmox/unregister-cluster-handler.ts";
import { UnregisterCluster } from "@server/cluster/application/commands/proxmox/unregister-cluster.ts";

/**
 * Endpoint `cluster.unregister` — removes a cluster from the catalog.
 *
 * Thin inbound adapter: hands the command to `UnregisterClusterHandler`.
 * Returns an empty Ack on success.
 */
export class UnregisterClusterEndpoint implements
  ProtectedEndpoint<
    "cluster.unregister",
    ClusterUnregisterRequest,
    ClusterUnregisterResponse
  > {
  readonly method = "cluster.unregister" as const;

  constructor(private readonly handler: UnregisterClusterHandler) {}

  async dispatch(
    request: ClusterUnregisterRequest,
  ): Promise<ClusterUnregisterResponse> {
    await this.handler.handle(new UnregisterCluster(request.id));
    return {};
  }
}
