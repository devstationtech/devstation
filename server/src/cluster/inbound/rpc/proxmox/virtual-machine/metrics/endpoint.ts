import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterProxmoxVirtualMachineMetricsRequest,
  ClusterProxmoxVirtualMachineMetricsResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as VirtualMachineMetricsQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/metrics/query.ts";

/**
 * Endpoint `cluster.proxmox.virtualMachine.metrics` — RRD time-series for a single VM.
 *
 * Never throws on missing cluster/connection/node — the underlying query
 * returns an empty array in those cases. Surface error handling stays at
 * the integration boundary.
 */
export class VirtualMachineMetricsEndpoint implements
  ProtectedEndpoint<
    "cluster.proxmox.virtualMachine.metrics",
    ClusterProxmoxVirtualMachineMetricsRequest,
    ClusterProxmoxVirtualMachineMetricsResponse
  > {
  readonly method = "cluster.proxmox.virtualMachine.metrics" as const;

  constructor(private readonly query: VirtualMachineMetricsQuery) {}

  async dispatch(
    request: ClusterProxmoxVirtualMachineMetricsRequest,
  ): Promise<ClusterProxmoxVirtualMachineMetricsResponse> {
    return await this.query.execute(
      request.clusterId,
      request.nodeId,
      request.virtualMachineId,
      request.timeframe,
    );
  }
}
