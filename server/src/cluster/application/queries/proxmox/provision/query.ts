import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { ProvisionNodeRecord } from "@server/cluster/application/queries/proxmox/provision/types/provision-node-record.ts";
import type { ProvisionRecord } from "@server/cluster/application/queries/proxmox/provision/types/provision-record.ts";
import type { ProvisionImageRecord } from "@server/cluster/application/queries/proxmox/provision/types/provision-image-record.ts";
import type { ProvisionVirtualMachineRecord } from "@server/cluster/application/queries/proxmox/provision/types/provision-virtual-machine-record.ts";
import type { RawCluster } from "@server/cluster/application/queries/proxmox/provision/types/raw-cluster.ts";
import type { RawCredential } from "@server/cluster/application/queries/proxmox/provision/types/raw-credential.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import type { RawVirtualMachine } from "@server/cluster/application/queries/proxmox/provision/types/raw-virtual-machine.ts";

const CLUSTERS_FILE = "clusters.json";
// Provision preview groups VMs by node directly. Role/environment
// catalogs are gone — VMs carry free `tags` instead.
export class Query {
  constructor(private readonly fs: FileSystem) {}

  async execute(clusterId: string): Promise<ProvisionRecord | null> {
    const clusters = await this.fs.readObjectsOf<RawCluster>(CLUSTERS_FILE);
    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return null;

    // Image names come from the per-node snapshot taken at assign time
    // (the central catalog lives in the `images` context now).
    const templateMap = new Map<string, string>();
    for (const node of cluster.nodes) {
      for (const nt of node.images) {
        if (nt.name) templateMap.set(nt.imageId, nt.name);
      }
    }
    const connected = cluster.connection !== null;

    const nodes: ProvisionNodeRecord[] = cluster.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      ip: node.address,
      hasCredential: this.hasRealCredential(node.credential),
      virtualMachines: node.virtualMachines.map((i) => this.toVirtualMachineRecord(i, templateMap)),
    }));

    const images: ProvisionImageRecord[] = [];
    for (const node of cluster.nodes) {
      for (const nt of node.images) {
        images.push({
          id: nt.imageId,
          name: templateMap.get(nt.imageId) ?? nt.imageId,
          virtualMachineId: nt.virtualMachineId,
          nodeId: node.id,
          nodeName: node.name,
        });
      }
    }

    return {
      clusterId: cluster.id,
      clusterName: cluster.name,
      connected,
      nodes,
      images,
    };
  }

  private hasRealCredential(c: RawCredential): boolean {
    return c.vaultId !== Credential.UNCONFIGURED_ID &&
      c.usernameSecretId !== Credential.UNCONFIGURED_ID &&
      c.passwordSecretId !== Credential.UNCONFIGURED_ID;
  }

  private toVirtualMachineRecord(
    i: RawVirtualMachine,
    templateMap: Map<string, string>,
  ): ProvisionVirtualMachineRecord {
    return {
      id: i.id,
      name: i.name,
      tags: i.tags ?? [],
      image: i.image,
      imageName: templateMap.get(i.image) ?? i.image,
      ip: i.address,
      gateway: i.gateway,
      dns: i.dns,
      storage: i.storage,
      cpu: i.resources.cpu,
      ram: i.resources.ram,
      disk: i.resources.disk,
    };
  }
}
