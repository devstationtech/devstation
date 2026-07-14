import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { Cluster } from "@server/cluster/domain/models/cluster.ts";
import { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id } from "@server/cluster/domain/models/id.ts";
import { Name } from "@server/cluster/domain/models/name.ts";
import { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Name as NodeName } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import { Network } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/network.ts";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Gateway } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/gateway.ts";
import { Dns } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/dns.ts";
import { Storage } from "@server/cluster/domain/models/proxmox/nodes/storage.ts";
import { Node as ProxmoxNode } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import { State } from "@server/cluster/domain/models/proxmox/nodes/state.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { VirtualMachine } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machine.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { Name as VirtualMachineName } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/name.ts";
import { ProxmoxResources } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/resources.ts";
import { Cpu } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/cpu.ts";
import { Ram } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/ram.ts";
import { Disk } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/disk.ts";
import { Size } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/size.ts";
import { Tags } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/tags.ts";
import { Connection as ProxmoxConnection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import { ProvisioningPolicy } from "@server/cluster/domain/models/proxmox/connection/provisioning-policy.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Nodes as ProxmoxNodes } from "@server/cluster/domain/models/proxmox/nodes/nodes.ts";
import { VirtualMachines } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machines.ts";
import { NodeImages } from "@server/cluster/domain/models/proxmox/nodes/images/node-images.ts";
import { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";
import { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import { AssignedImage } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/assigned-image.ts";
import { Name as ImageName } from "@server/cluster/domain/models/proxmox/images/name.ts";
import { Source } from "@server/cluster/domain/models/proxmox/images/source.ts";
import { Url } from "@server/cluster/domain/models/proxmox/images/url.ts";
import type { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { Service as VirtualMachineService } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/services/service.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import { StaleClusterVersion } from "@server/cluster/domain/exceptions/stale-cluster-version.ts";
import type { Logger } from "@server/shared/observability/domain/ports/outbound/logger.ts";

const FILENAME = "clusters.json";

export class Adapter implements Clusters {
  // Every write to the shared clusters.json is a read-modify-write of the
  // whole collection. Serialize them so two concurrent commands cannot
  // lose each other's changes. Reads stay unserialized; the long
  // provisioning run is outside this critical section (handlers call
  // `update` between phases, never during).
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: FileSystem,
    private readonly logger: Logger,
  ) {}

  private serialize<T>(critical: () => Promise<T>): Promise<T> {
    const result = this.writeChain.then(critical, critical);
    // The chain must never reject (a failed write must not wedge the
    // next one); callers still get their own rejection via `result`.
    this.writeChain = result.then(() => {}, () => {});
    return result;
  }

  async of<T extends Cluster>(id: Id): Promise<T> {
    const clusters = await this.readAll();
    const cluster = clusters.find((c) => c.id.value === id.value);
    if (!cluster) throw new Error(`cluster '${id.value}' not found.`);
    return cluster as unknown as T;
  }

  all(): Promise<Cluster[]> {
    return this.readAll();
  }

  add(cluster: Cluster): Promise<void> {
    return this.serialize(async () => {
      const clusters = await this.readAll();
      await this.fs.writeObjectsOf(FILENAME, this.serializeAll([...clusters, cluster]));
    });
  }

  update<T extends Cluster>(
    id: Id,
    change: (cluster: T) => void | Promise<void>,
  ): Promise<T> {
    return this.serialize(async () => {
      const clusters = await this.readAll();
      const index = clusters.findIndex((c) => c.id.value === id.value);
      if (index === -1) throw new Error(`cluster '${id.value}' not found.`);
      const cluster = clusters[index] as unknown as T;
      const base = (cluster as unknown as Cluster).version.value;
      await change(cluster);
      // Defense-in-depth: inside the serialized turn nobody else can
      // have written, so this only trips on an out-of-band/multi-process
      // write — a loud error instead of a silent lost update.
      const persisted = (await this.readAll()).find((c) => c.id.value === id.value);
      if (persisted && persisted.version.value !== base) {
        throw new StaleClusterVersion(id.value, base, persisted.version.value);
      }
      clusters[index] = cluster as unknown as Cluster;
      await this.fs.writeObjectsOf(FILENAME, this.serializeAll(clusters));
      return cluster;
    });
  }

  remove(id: Id): Promise<void> {
    return this.serialize(async () => {
      const clusters = await this.readAll();
      const next = clusters.filter((c) => c.id.value !== id.value);
      if (next.length === clusters.length) throw new Error(`cluster '${id.value}' not found.`);
      await this.fs.writeObjectsOf(FILENAME, this.serializeAll(next));
    });
  }

  async exists(name: Name): Promise<boolean> {
    const clusters = await this.readAll();
    return clusters.some((c) => c.name.value === name.value);
  }

  async byName<T extends Cluster>(name: Name): Promise<T | null> {
    const clusters = await this.readAll();
    const found = clusters.find((c) => c.name.value === name.value);
    return (found ?? null) as T | null;
  }

  private async readAll(): Promise<Cluster[]> {
    const records = await this.fs.readObjectsOf<Record<string, unknown>>(FILENAME);
    return this.unserialize(records);
  }

  private unserialize(records: Record<string, unknown>[]): Cluster[] {
    return records.map((record) => {
      const creation = record.creation as Record<string, string>;
      // Legacy backfill: older files kept an image catalog at cluster level;
      // lift each assigned image's snapshot (name/os/source) onto its NodeImage.
      const legacyImages = this.unserializeLegacyImages((record.images as unknown[]) ?? []);
      const nodes = this.unserializeNodes((record.nodes as unknown[]) ?? [], legacyImages);
      const connection = this.unserializeConnection(record);
      return new ProxmoxCluster(
        new Id(record.id as string),
        new Name(record.name as string),
        new Creation(
          new User(creation.by),
          new Hostname(creation.hostname),
          Instant.fromString(creation.at),
        ),
        new ProxmoxNodes(nodes),
        connection,
        new Version(record.version as number),
      );
    });
  }

  private unserializeLegacyImages(
    raw: unknown[],
  ): Map<string, { name: ImageName; os: OperatingSystem; source: Source }> {
    const map = new Map<string, { name: ImageName; os: OperatingSystem; source: Source }>();
    for (const r of raw) {
      const t = r as Record<string, unknown>;
      map.set(t.id as string, {
        name: new ImageName(t.name as string),
        os: t.os as OperatingSystem,
        source: new Source(new Url(t.imageUrl as string)),
      });
    }
    return map;
  }

  private unserializeConnection(record: Record<string, unknown>): ProxmoxConnection | undefined {
    const single = record.connection as Record<string, unknown> | null | undefined;
    if (!single) return undefined;
    // `policy` absent in legacy records → default.
    const rawPolicy = single.policy as
      | { cloneStrategy?: string; parallelism?: number }
      | undefined;
    return new ProxmoxConnection(
      new Hostname(single.host as string),
      new Vault(single.vaultId as string),
      new Secret(single.secretId as string),
      ProvisioningPolicy.from(rawPolicy?.cloneStrategy, rawPolicy?.parallelism),
    );
  }

  private unserializeNodes(
    raw: unknown[],
    legacyImages: Map<string, { name: ImageName; os: OperatingSystem; source: Source }>,
  ): ProxmoxNode[] {
    return raw.map((r) => {
      const n = r as Record<string, unknown>;
      const rawVirtualMachines = (n.virtualMachines as Record<string, unknown>[] | undefined) ?? [];
      const virtualMachines = rawVirtualMachines.map((i) => {
        const res = i.resources as Record<string, number>;
        const services = ((i.services as Record<string, string>[] | undefined) ?? []).map((s) =>
          new VirtualMachineService(
            s.serviceId,
            s.serviceName,
            s.blueprint,
            s.role,
            // `deployedAt` is the legacy key (renamed to `installedAt`); read
            // both so state written before the rename still loads.
            Instant.fromString(s.installedAt ?? s.deployedAt),
          )
        );
        // Legacy records may carry `roleId`/`environmentId`; they are
        // intentionally ignored (role/environment are no longer modeled).
        // `tags` is optional — absent in older records → empty.
        return new VirtualMachine(
          new VirtualMachineId(i.id as number),
          new VirtualMachineName(i.name as string),
          new Size(i.sizeId as string),
          new AssignedImage(i.image as string),
          new ProxmoxResources(new Cpu(res.cpu), new Ram(res.ram), new Disk(res.disk)),
          new Network(
            new Ip(i.address as string),
            new Gateway(i.gateway as string),
            new Dns(i.dns as string),
          ),
          new Storage(i.storage as string),
          new Vault(i.credentialVaultId as string),
          new Secret(i.usernameSecretId as string),
          new Secret(i.passwordSecretId as string),
          new Tags((i.tags as string[] | undefined) ?? []),
          services,
        );
      });
      const rawNodeImages = (n.images as Record<string, unknown>[] | undefined) ?? [];
      const nodeImages = rawNodeImages.map((t) => {
        const imageId = new ImageId(t.imageId as string);
        const legacy = legacyImages.get(imageId.value);
        const name = t.name !== undefined ? new ImageName(t.name as string) : legacy?.name;
        const os = t.os !== undefined ? (t.os as OperatingSystem) : legacy?.os;
        const source = t.sourceUrl !== undefined
          ? new Source(new Url(t.sourceUrl as string))
          : legacy?.source;
        if (!name || !os || !source) {
          throw new Error(`node image ${imageId.value} has no catalog snapshot to load`);
        }
        return new NodeImage(
          imageId,
          name,
          os,
          source,
          new VirtualMachineId(t.virtualMachineId as number),
          new Storage(t.storage as string),
        );
      });
      const cred = n.credential as Record<string, string>;
      const credential = new Credential(
        new Vault(cred.vaultId),
        new Secret(cred.usernameSecretId),
        new Secret(cred.passwordSecretId),
      );
      const state = (n.state as State | undefined) ?? State.REGISTERED;
      return new ProxmoxNode(
        new NodeId(n.id as string),
        new NodeName(n.name as string),
        new Ip(n.address as string),
        credential,
        new NodeImages(nodeImages),
        new VirtualMachines(virtualMachines),
        state,
      );
    });
  }

  private serializeAll(clusters: Cluster[]): Record<string, unknown>[] {
    return clusters.map((cluster) => {
      const proxmox = cluster as ProxmoxCluster;
      const connection = proxmox.connection;
      return {
        provider: cluster.provider,
        id: cluster.id.value,
        version: cluster.version.value,
        name: cluster.name.value,
        creation: {
          by: cluster.creation.by.value,
          hostname: cluster.creation.hostname.value,
          at: cluster.creation.at.toString(),
        },
        connection: connection
          ? {
            host: connection.host.value,
            vaultId: connection.vault.value,
            secretId: connection.secret.value,
            policy: {
              cloneStrategy: connection.policy.cloneStrategy,
              parallelism: connection.policy.parallelism,
            },
          }
          : null,
        nodes: proxmox.nodes.items.map((p) => ({
          id: p.id.value,
          name: p.name.value,
          address: p.ip.value,
          state: p.state,
          credential: {
            vaultId: p.credential.vault.value,
            usernameSecretId: p.credential.username.value,
            passwordSecretId: p.credential.password.value,
          },
          images: p.images.items.map((t) => ({
            imageId: t.imageId.value,
            name: t.name.value,
            os: t.os,
            sourceUrl: t.source.url.value,
            virtualMachineId: t.virtualMachineId.value,
            storage: t.storage.value,
          })),
          virtualMachines: p.virtualMachines.items.map((vm) => ({
            id: vm.id.value,
            name: vm.name.value,
            sizeId: vm.size.value,
            image: vm.image.value,
            tags: vm.tags.values,
            address: vm.network.ip.value,
            gateway: vm.network.gateway.value,
            dns: vm.network.dns.value,
            storage: vm.storage.value,
            credentialVaultId: vm.credentialVault.value,
            usernameSecretId: vm.usernameSecret.value,
            passwordSecretId: vm.passwordSecret.value,
            resources: {
              cpu: vm.resources.cpu.value,
              ram: vm.resources.ram.value,
              disk: vm.resources.disk.value,
            },
            services: vm.services.map((s) => ({
              serviceId: s.serviceId,
              serviceName: s.serviceName,
              stack: s.blueprint,
              role: s.role,
              installedAt: s.installedAt.toString(),
            })),
          })),
        })),
      };
    });
  }
}
