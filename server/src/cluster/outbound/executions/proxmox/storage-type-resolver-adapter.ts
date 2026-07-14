import type { StorageTypeResolver } from "@server/cluster/domain/ports/outbound/storage-type-resolver.ts";
import type { Connection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";

/**
 * Resolves datastore→type via the existing Proxmox read API (same one
 * the read queries use). `ProxmoxConnectionRecord` is `{host, vaultId,
 * secretId}` — exactly the domain `Connection` fields. Best-effort:
 * any failure yields an empty map so provisioning degrades to full
 * clone instead of crashing.
 */
export class StorageTypeResolverAdapter implements StorageTypeResolver {
  constructor(private readonly apiFactory: ProxmoxReadApiFactory) {}

  async resolve(
    connection: Connection,
    nodeName: string,
  ): Promise<ReadonlyMap<string, string>> {
    try {
      const api = await this.apiFactory.create({
        host: connection.host.value,
        vaultId: connection.vault.value,
        secretId: connection.secret.value,
      });
      if (!api) return new Map();
      const storages = await api.storages(nodeName);
      return new Map(storages.map((s) => [s.id, s.type]));
    } catch {
      return new Map();
    }
  }
}
