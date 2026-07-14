import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxTestConnectionRequest,
  ClusterProxmoxTestConnectionResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as TestProxmoxConnectionQuery } from "@server/cluster/application/queries/proxmox/test-connection/query.ts";

/**
 * Endpoint `cluster.proxmox.testConnection` — pings a Proxmox API with
 * the given host + token and reports back the discriminated outcome.
 *
 * Never throws on connection failure — the query swallows errors and
 * returns `{ ok: false, error }`.
 */
export class TestProxmoxConnectionEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.testConnection",
    ClusterProxmoxTestConnectionRequest,
    ClusterProxmoxTestConnectionResponse
  > {
  readonly method = "cluster.proxmox.testConnection" as const;

  constructor(private readonly query: TestProxmoxConnectionQuery) {}

  async dispatch(
    request: ClusterProxmoxTestConnectionRequest,
  ): Promise<ClusterProxmoxTestConnectionResponse> {
    return await this.query.execute(request.host, request.token);
  }
}
