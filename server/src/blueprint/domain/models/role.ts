import type { Step } from "@server/blueprint/domain/models/step/step.ts";
import type { Instances } from "@server/blueprint/domain/models/instances.ts";

/**
 * One role inside a base blueprint. Each role has its own ordered step
 * sequence; the installer runs the whole sequence per instance, in the order
 * roles are declared.
 *
 * `instances` constrains how many instances the operator can pick at
 * register time (`one`: exactly one; `many`: one or more). Default is
 * `one` — the conservative, most common case (single primary, single
 * server). Roles that genuinely accept N peers (workers, agents, replicas)
 * declare `many` explicitly.
 */
export class Role {
  constructor(
    readonly name: string,
    readonly instances: Instances,
    readonly installSteps: readonly Step[],
    /** Optional uninstall steps, run per instance in reverse role order. */
    readonly uninstallSteps: readonly Step[] = [],
  ) {
    if (!name) throw new Error("role name is required.");
    if (installSteps.length === 0) throw new Error(`role '${name}' must have at least one step.`);
  }
}
