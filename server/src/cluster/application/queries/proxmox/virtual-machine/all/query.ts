import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ProxmoxVirtualMachineRecord } from "@server/cluster/application/queries/proxmox/records/virtual-machine-record.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import type { RawCluster } from "@server/cluster/application/queries/proxmox/virtual-machine/all/types/raw-cluster.ts";
import type { RawSize } from "@server/cluster/application/queries/proxmox/virtual-machine/all/types/raw-size.ts";

const CLUSTERS_FILE = "clusters.json";
const SIZES_FILE = "sizes.json";

/**
 * Raised by `executeOrThrow` when the cluster or node referenced by
 * the caller is absent from the catalog. The base `execute` keeps
 * returning `[]` because the RPC contract (consumed by the TUI) is
 * lenient by design — the UI always reads from its own catalog view
 * so a miss is the user's stale screen, not an LLM hallucination.
 *
 * `executeOrThrow` exists for MCP, where an LLM agent calling the
 * tool needs to distinguish "the node has no VMs" from "you got the
 * id wrong."
 */
export class ClusterOrNodeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClusterOrNodeNotFoundError";
  }
}

export class Query {
  constructor(
    private readonly fs: FileSystem,
    private readonly apiFactory: ProxmoxReadApiFactory,
  ) {}

  async execute(clusterId: string, nodeId: string): Promise<ProxmoxVirtualMachineRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);

    const defs = await this.fs.readObjectsOf<RawSize>(SIZES_FILE);
    const defMap = new Map(defs.map((d) => [d.id, d.name]));

    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return [];
    const node = cluster.nodes.find((n) => n.id === nodeId);
    if (!node) return [];

    const tmplMap = new Map((node.images ?? []).map((t) => [t.imageId, t]));

    const virtualMachines: ProxmoxVirtualMachineRecord[] = node.virtualMachines.map((i) => ({
      id: i.id,
      name: i.name,
      tags: i.tags ?? [],
      sizeId: i.sizeId,
      sizeName: defMap.get(i.sizeId) ?? i.sizeId,
      image: i.image,
      imageName: tmplMap.get(i.image)?.name ?? i.image,
      imageOs: tmplMap.get(i.image)?.os ?? "",
      ip: i.address,
      gateway: i.gateway,
      dns: i.dns,
      storage: i.storage,
      credentialVaultId: i.credentialVaultId,
      usernameSecretId: i.usernameSecretId,
      passwordSecretId: i.passwordSecretId,
      resources: {
        connected: false,
        local: i.resources,
      },
      services: i.services ?? [],
    }));

    if (!cluster.connection) return virtualMachines;

    const api = await this.apiFactory.create(cluster.connection);
    if (!api) return virtualMachines;

    let liveById;
    try {
      liveById = await api.liveVirtualMachines(node.name);
    } catch {
      return virtualMachines; // graceful — keep static records when provider unreachable
    }

    return virtualMachines.map((vm) => {
      const live = liveById.get(vm.id);
      return live ? { ...vm, resources: { ...vm.resources, connected: true, live } } : vm;
    });
  }

  /**
   * Strict variant for MCP — throws `ClusterOrNodeNotFoundError` when
   * the cluster or node is absent. An empty array still means "this
   * node really has no VMs" — that case is not an error.
   */
  async executeOrThrow(
    clusterId: string,
    nodeId: string,
  ): Promise<ProxmoxVirtualMachineRecord[]> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) {
      throw new ClusterOrNodeNotFoundError(
        `cluster '${clusterId}' not found. Use devstation_cluster_list to discover ids.`,
      );
    }
    if (!cluster.nodes.find((n) => n.id === nodeId)) {
      throw new ClusterOrNodeNotFoundError(
        `node '${nodeId}' not found in cluster '${clusterId}'. ` +
          `Use devstation_cluster_nodes_list with the same clusterId to discover node ids.`,
      );
    }
    return this.execute(clusterId, nodeId);
  }
}
