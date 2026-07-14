import type { Connection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";

/**
 * Resolves the Proxmox storage backend type per datastore for a node,
 * so the clone strategy can be decided in `AUTO` mode.
 *
 * Returns a map `datastoreId → type` (e.g. `local-zfs → zfspool`).
 * On no connection / unreachable provider / error it returns an
 * **empty map** — callers must degrade (treat unknown as full clone),
 * never throw provisioning over a missing storage lookup.
 */
export interface StorageTypeResolver {
  resolve(
    connection: Connection,
    nodeName: string,
  ): Promise<ReadonlyMap<string, string>>;
}
