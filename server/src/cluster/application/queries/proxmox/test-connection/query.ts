import { ProxmoxIntegration } from "@server/cluster/application/queries/proxmox/api/integration.ts";
import type { TestConnectionRecord } from "@server/cluster/application/queries/proxmox/test-connection/types/test-connection-record.ts";

export type IntegrationFactory = (host: string, token: string) => ProxmoxIntegration;

export class Query {
  constructor(
    private readonly integrationFactory: IntegrationFactory = (h, t) =>
      new ProxmoxIntegration(h, t),
  ) {}

  async execute(host: string, token: string): Promise<TestConnectionRecord> {
    try {
      const integration = this.integrationFactory(host, token);
      const resources = await integration.clusterResources();
      const nodeCount = resources.filter((r) => r.type === "node").length;
      return { ok: true, nodeCount };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "connection failed." };
    }
  }
}
