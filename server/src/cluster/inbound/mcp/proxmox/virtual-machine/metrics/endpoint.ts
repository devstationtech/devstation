import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Query as VirtualMachineMetricsQuery } from "@server/cluster/application/queries/proxmox/virtual-machine/metrics/query.ts";
import type { ProxmoxMetricsTimeframe } from "@server/cluster/application/queries/proxmox/records/metrics-timeframe.ts";

type Args = {
  clusterId: string;
  nodeId: string;
  virtualMachineId: number;
  timeframe: ProxmoxMetricsTimeframe;
};

/**
 * MCP endpoint `devstation_cluster_virtual_machine_metrics` — RRD time-series for a
 * single VM. Returns an empty array when the cluster/node/connection is
 * unreachable. Read-only; never throws.
 */
export class VirtualMachineMetricsMcpEndpoint
  implements Endpoint<"devstation_cluster_virtual_machine_metrics", Args, unknown> {
  readonly name = "devstation_cluster_virtual_machine_metrics" as const;
  readonly title = "VM Metrics";
  readonly description =
    "RRD time-series for a single Proxmox VM. Returns an empty array when the cluster/node/connection is unreachable. Never throws.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: {
      clusterId: { type: "string" },
      nodeId: { type: "string" },
      virtualMachineId: { type: "number" },
      timeframe: { type: "string", enum: ["hour", "day", "week", "month", "year"] },
    },
    required: ["clusterId", "nodeId", "virtualMachineId", "timeframe"],
    additionalProperties: false,
  };

  constructor(private readonly query: VirtualMachineMetricsQuery) {}

  async dispatch(args: Args): Promise<unknown> {
    return await this.query.execute(
      args.clusterId,
      args.nodeId,
      args.virtualMachineId,
      args.timeframe,
    );
  }
}
