import type { Station } from "@server/station/domain/models/station.ts";
import type { Id } from "@server/station/domain/models/id.ts";
import type { Name } from "@server/station/domain/models/name.ts";

/**
 * Write-side repository for stations. Listing is intentionally absent —
 * the read side belongs in `query/station/`.
 */
export interface Stations {
  of(id: Id): Promise<Station>;
  byName(name: Name): Promise<Station | null>;
  add(station: Station): Promise<void>;
  save(station: Station): Promise<void>;
  /**
   * Serialized read-modify-write: reloads the aggregate fresh inside the
   * write lock, applies `change`, persists, and returns the updated
   * aggregate (events still in its bag — dispatch after). Long-running
   * flows (a install holds its snapshot for minutes) MUST mutate through
   * this instead of `save`, or they silently overwrite concurrent
   * changes made while the install was in flight.
   */
  update(id: Id, change: (station: Station) => void): Promise<Station>;
  remove(id: Id): Promise<void>;
}
