import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ProxmoxNodeRecord } from "@server/cluster/application/queries/proxmox/records/node-record.ts";
import type { ProxmoxResources } from "@server/cluster/application/queries/proxmox/records/resources.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { RawCluster } from "@server/cluster/application/queries/proxmox/node/all/types/raw-cluster.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";

const CLUSTERS_FILE = "clusters.json";

const defaultResources: ProxmoxResources = {
  connected: false,
  local: { cpu: 0, ram: 0, disk: 0 },
};

// Transient states whose presence on a freshly-read cluster (i.e., no
// live executions in the current process) implies the previous long-running
// operation was interrupted. The projection surfaces this flag so the UI
// can offer an acknowledge action.
const TRANSIENT_STATES = new Set([
  "PLAN_STARTED",
  "APPLY_STARTED",
  "DESTROY_STARTED",
]);

export class Query {
  constructor(
    private readonly fs: FileSystem,
    private readonly apiFactory: ProxmoxReadApiFactory,
    private readonly logger?: Logger,
  ) {}

  async execute(clusterId: string): Promise<ProxmoxNodeRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return [];

    const nodes: ProxmoxNodeRecord[] = cluster.nodes.map((n) => {
      const state = n.state ?? "REGISTERED";
      return {
        id: n.id,
        name: n.name,
        ip: n.address,
        credential: {
          vaultId: n.credential.vaultId,
          usernameSecretId: n.credential.usernameSecretId,
          passwordSecretId: n.credential.passwordSecretId,
        },
        virtualMachineCount: n.virtualMachines.length,
        resources: { ...defaultResources },
        state,
        interrupted: TRANSIENT_STATES.has(state),
      };
    });

    if (!cluster.connection) return nodes;

    // Provider enrichment is best-effort: secret resolution, API factory
    // creation, and the live query can all fail (no vault token, provider
    // unreachable, auth error). The endpoint contract is "never throws" —
    // any failure must degrade to the static catalog rows, not reject the
    // whole list (which would blank the cluster screen entirely).
    try {
      const api = await this.apiFactory.create(cluster.connection);
      if (!api) return nodes;

      const liveByName = await api.liveNodes();
      const enriched = nodes.map((node) => {
        const live = liveByName.get(node.name);
        return live ? { ...node, resources: { ...node.resources, connected: true, live } } : node;
      });

      // Succeeded-but-no-match is the silent failure that shows every
      // node at 0% with no error: the connection is "connected" yet
      // resources never populate. Surface why — Proxmox filters
      // /cluster/resources by token privileges (empty array, HTTP 200,
      // no throw), and the registered node name must equal the Proxmox
      // node name. Logs: ~/.devstation/logs/.
      const unmatched = nodes.filter((n) => !liveByName.has(n.name)).map((n) => n.name);
      if (unmatched.length > 0) {
        const available = [...liveByName.keys()];
        await this.logger?.warn(
          "cluster.proxmox.nodes.list",
          available.length === 0
            ? `cluster '${cluster.id}' (${cluster.connection.host}): Proxmox returned 0 nodes — the API token likely lacks read access (needs PVEAuditor / Sys.Audit on '/'). No live resources for: ${
              unmatched.join(", ")
            }.`
            : `cluster '${cluster.id}' (${cluster.connection.host}): no live match for [${
              unmatched.join(", ")
            }] — Proxmox node names are [${
              available.join(", ")
            }]. The registered node name must equal the Proxmox node name.`,
        );
      }
      return enriched;
    } catch (error) {
      // graceful — keep static records when provider unreachable, but make
      // the reason diagnosable (silent degradation otherwise looks like a
      // working-but-empty integration). Logs: ~/.devstation/logs/.
      const reason = error instanceof Error ? error.message : String(error);
      await this.logger?.warn(
        "cluster.proxmox.nodes.list",
        `provider enrichment failed for cluster '${cluster.id}' (${cluster.connection.host}): ${reason}`,
      );
      return nodes;
    }
  }
}
