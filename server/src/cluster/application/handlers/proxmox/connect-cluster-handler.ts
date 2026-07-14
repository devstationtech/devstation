import { Id } from "@server/cluster/domain/models/id.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { ConnectCluster } from "@server/cluster/application/commands/proxmox/connect-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { ProxmoxIntegration } from "@server/cluster/application/queries/proxmox/api/integration.ts";
import type { IntegrationFactory } from "@server/cluster/application/queries/proxmox/test-connection/query.ts";

/**
 * Probes the Proxmox API before persisting the connection. Without a
 * probe, `cluster.connect` would mark the cluster "connected" regardless
 * of reachability, and the user would only learn of a bad connection when
 * a later live RPC (`storage_by_node`, `nodes_list`, …) failed silently
 * and fell back to empty caches. The fix: resolve the API token from the
 * vault and run the same `clusterResources()` probe that
 * `cluster.test_connection` runs — if either step fails, refuse the
 * connect with a useful message.
 *
 * The probe is wrapped in an injected `IntegrationFactory` so tests
 * can stub it; the default is the real `ProxmoxIntegration`.
 */
export class ConnectClusterHandler {
  constructor(
    private readonly clusters: Clusters,
    private readonly secrets: SecretResolver,
    private readonly integrationFactory: IntegrationFactory = (host, token) =>
      new ProxmoxIntegration(host, token),
  ) {}

  async handle(command: ConnectCluster): Promise<void> {
    const token = await this.secrets.resolve(
      new Vault(command.vaultId),
      new Secret(command.secretId),
    );
    if (!token) {
      throw new Error(
        `connect aborted: secret '${command.secretId}' not found in vault '${command.vaultId}'.`,
      );
    }
    try {
      await this.integrationFactory(command.host, token).clusterResources();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`connect aborted: probe failed (${reason}).`);
    }

    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        if (!(cluster instanceof ProxmoxCluster)) {
          throw new Error(`cluster ${command.clusterId} is not a proxmox cluster`);
        }
        cluster.connect(command.toProxmoxConnection());
      },
    );
  }
}
