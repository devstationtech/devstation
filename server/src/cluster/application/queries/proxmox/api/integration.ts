import type { ClusterResource } from "@server/cluster/application/queries/proxmox/api/response/cluster-resource.ts";
import type { NodeStorage } from "@server/cluster/application/queries/proxmox/api/response/node-storage.ts";
import type { VirtualMachineMetricPoint } from "@server/cluster/application/queries/proxmox/api/response/virtual-machine-metric-point.ts";
import type { ProxmoxMetricsTimeframe } from "@server/cluster/application/queries/proxmox/records/metrics-timeframe.ts";
import { HttpClient, HttpClientError } from "@server/shared/http/outbound/client.ts";

export class ProxmoxIntegration {
  private readonly http = new HttpClient();
  private readonly baseUrl: string;
  private readonly requestOptions;

  constructor(host: string, token: string) {
    this.baseUrl = `${normalizeProxmoxOrigin(host)}/api2/json`;
    this.requestOptions = {
      headers: { "Authorization": `PVEAPIToken=${token}` },
      timeoutSeconds: 5,
      skipTlsVerification: true,
    };
  }

  async clusterResources(): Promise<ClusterResource[]> {
    return await this.get<ClusterResource[]>("/cluster/resources");
  }

  async nodeStorages(nodeName: string): Promise<NodeStorage[]> {
    return await this.get<NodeStorage[]>(`/nodes/${nodeName}/storage`);
  }

  async vmMetrics(
    nodeName: string,
    virtualMachineId: number,
    timeframe: ProxmoxMetricsTimeframe,
  ): Promise<VirtualMachineMetricPoint[]> {
    return await this.get<VirtualMachineMetricPoint[]>(
      `/nodes/${nodeName}/qemu/${virtualMachineId}/rrddata?timeframe=${timeframe}&cf=AVERAGE`,
    );
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let result;
    try {
      result = await this.http.getJson<{ data: T }>(url, this.requestOptions);
    } catch (err) {
      const msg = err instanceof HttpClientError ? err.message : "unknown error";
      throw new Error(`proxmox API: ${msg}`);
    }

    if (result.status === 401 || result.status === 403) {
      throw new Error("proxmox API authentication failed. check your API token.");
    }

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`proxmox API returned HTTP ${result.status}.`);
    }

    if (!result.data) {
      throw new Error("proxmox API returned empty response.");
    }

    return result.data.data;
  }
}

/**
 * Builds `https://host:port` from whatever shape the user typed in.
 * Hostname VO accepts any non-whitespace string, so the engine routinely
 * sees inputs like "192.168.15.100", "proxmox.local:8006",
 * "https://pve1.lan", or "[2001:db8::1]:8443". Constructing the URL
 * with a hardcoded ":8006" suffix turned the second form into
 * "https://proxmox.local:8006:8006" when given "proxmox.local:8006".
 *
 * Rules:
 *  - Strip http(s):// if present (we always use https).
 *  - Keep an explicit port when present; otherwise default to 8006.
 *  - Bracketed IPv6 is preserved as-is; unbracketed IPv6 (`::1`) is
 *    ambiguous (`:` is both the segment and port separator) and is
 *    not supported — surfaces as an invalid URL on connect.
 */
function normalizeProxmoxOrigin(host: string): string {
  const stripped = host.trim().replace(/^https?:\/\//i, "");
  const ipv6 = /^\[[^\]]+\](?::\d+)?$/.test(stripped);
  if (ipv6) {
    return stripped.includes("]:") ? `https://${stripped}` : `https://${stripped}:8006`;
  }
  const hasPort = /^[^:]+:\d+$/.test(stripped);
  return hasPort ? `https://${stripped}` : `https://${stripped}:8006`;
}
