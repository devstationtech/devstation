import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

/**
 * Identifies a topology slot inside a service. In single services, the
 * topology has exactly one role (typically named after the workload — e.g.
 * "main", "postgres"). In clustered services, multiple roles partition the
 * VMs by responsibility (e.g. "server", "agent" for k3s; "primary",
 * "replica" for postgres).
 */
export class Role implements ValueObject {
  constructor(readonly name: string) {
    if (!name) throw new Error("role name is required.");
    if (name.length > 64) throw new Error("role name must be at most 64 characters.");
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
      throw new Error("role name must be a lowercase slug (letters, digits and hyphens).");
    }
  }
}
