import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterRegisterRequest,
  ClusterRegisterResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { RegisterClusterHandler } from "@server/cluster/application/handlers/proxmox/register-cluster-handler.ts";
import { RegisterCluster } from "@server/cluster/application/commands/proxmox/register-cluster.ts";

/**
 * Endpoint `cluster.register` — registers a new cluster in the catalog.
 *
 * Thin inbound adapter: builds the application command and hands it to
 * `RegisterClusterHandler`. Returns an empty Ack on success.
 */
export class RegisterClusterEndpoint implements
  ProtectedEndpoint<
    "cluster.register",
    ClusterRegisterRequest,
    ClusterRegisterResponse
  > {
  readonly method = "cluster.register" as const;

  constructor(private readonly handler: RegisterClusterHandler) {}

  async dispatch(
    request: ClusterRegisterRequest,
  ): Promise<ClusterRegisterResponse> {
    await this.handler.handle(
      new RegisterCluster(request.name, request.user, request.hostname),
    );
    return {};
  }
}
