import type { Cluster } from "@server/cluster/domain/models/cluster.ts";
import type { Id } from "@server/cluster/domain/models/id.ts";
import type { Name } from "@server/cluster/domain/models/name.ts";

export interface Clusters {
  of<T extends Cluster>(id: Id): Promise<T>;
  byName<T extends Cluster>(name: Name): Promise<T | null>;
  /** Write-side iteration. Listeners that need to scan every cluster (e.g. to
   * find a VM by host) call this; the read side has dedicated queries in
   * `query/cluster/`. */
  all(): Promise<Cluster[]>;
  add(cluster: Cluster): Promise<void>;
  /**
   * The only way to persist a change to an existing cluster. Reloads the
   * aggregate fresh, applies `change`, persists and returns it — all
   * inside a per-store serialized critical section, so concurrent commands
   * cannot lose each other's writes on the shared `clusters.json` (no
   * stale read-modify-write). Long work (provisioning) must run *between*
   * `update` calls, never inside `change`, so it stays outside the lock.
   *
   * There is deliberately no blind `save(cluster)`: persisting an aggregate
   * loaded earlier would reintroduce the lost-update. The write API is the
   * triad add (create) / update (mutate) / remove (delete).
   */
  update<T extends Cluster>(id: Id, change: (cluster: T) => void | Promise<void>): Promise<T>;
  exists(name: Name): Promise<boolean>;
  remove(id: Id): Promise<void>;
}
