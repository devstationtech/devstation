import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxProvisionRequest,
  ClusterProxmoxProvisionResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as ProvisionQuery } from "@server/cluster/application/queries/proxmox/provision/query.ts";

/**
 * Endpoint `cluster.proxmox.provision` — provisioning topology preview.
 *
 * Underlying query returns `null` when the cluster is missing; here we
 * throw so the wire surfaces a clean error (mirrors `cluster.byId`).
 */
export class ProvisionEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.provision",
    ClusterProxmoxProvisionRequest,
    ClusterProxmoxProvisionResponse
  > {
  readonly method = "cluster.proxmox.provision" as const;

  constructor(private readonly query: ProvisionQuery) {}

  async dispatch(
    request: ClusterProxmoxProvisionRequest,
  ): Promise<ClusterProxmoxProvisionResponse> {
    const record = await this.query.execute(request.clusterId);
    if (!record) throw new Error(`cluster '${request.clusterId}' not found.`);
    return record;
  }
}
