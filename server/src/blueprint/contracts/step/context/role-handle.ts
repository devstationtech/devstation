import type { Peer } from "@server/blueprint/contracts/step/context/peer.ts";

/**
 * Read handle for a role's already-completed peers. `first()` is sugar for
 * the common case of a single-instance master role (k3s server, postgres
 * primary). `all()` returns every instance of that role.
 */
export interface RoleHandle {
  first(): Peer;
  all(): readonly Peer[];
}
