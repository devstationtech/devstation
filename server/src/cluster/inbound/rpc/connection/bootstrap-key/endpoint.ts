import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterConnectionBootstrapKeyRequest,
  ClusterConnectionBootstrapKeyResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { BootstrapKeyHandler } from "@server/cluster/application/handlers/connection/bootstrap-key-handler.ts";

/**
 * Endpoint `cluster.connection.bootstrapKey` — one-shot password SSH
 * to install the DevStation automation key on a remote, so subsequent
 * automation goes key-only. The password is consumed once here and
 * not stored. After this endpoint returns success, every other
 * cluster.* op against the host should work with the shared identity
 * (~/.ssh/devstation_ed25519).
 */
export class BootstrapKeyEndpoint implements
  ProtectedEndpoint<
    "cluster.connection.bootstrapKey",
    ClusterConnectionBootstrapKeyRequest,
    ClusterConnectionBootstrapKeyResponse
  > {
  readonly method = "cluster.connection.bootstrapKey" as const;

  constructor(private readonly handler: BootstrapKeyHandler) {}

  async dispatch(
    request: ClusterConnectionBootstrapKeyRequest,
  ): Promise<ClusterConnectionBootstrapKeyResponse> {
    return await this.handler.handle({
      clusterId: request.clusterId,
      nodeId: request.nodeId,
    });
  }
}
