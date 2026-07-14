import type { Name } from "@server/blueprint/domain/models/name.ts";
import type { Description } from "@server/blueprint/domain/models/description.ts";
import type { SemVer } from "@server/blueprint/domain/models/sem-ver.ts";
import type { Compatibility } from "@server/blueprint/domain/models/compatibility.ts";
import type { Placement } from "@server/blueprint/domain/models/placement.ts";
import type { Input } from "@server/blueprint/domain/models/input/input.ts";
import type { Role } from "@server/blueprint/domain/models/role.ts";
import type { Step } from "@server/blueprint/domain/models/step/step.ts";
import type { Host } from "@server/blueprint/domain/models/host.ts";

/**
 * Immutable blueprint loaded from `blueprints/<name>/blueprint.yaml`.
 * Two flavours:
 *
 * - **Standalone**: declares its own `roles[]`. The installer runs each role's
 *   steps on the VMs the operator picked at register time. Examples: docker, k3s.
 *
 * - **Hosted**: declares `host` (`{ blueprint, role }`) plus top-level
 *   `steps[]`. No VMs of its own — runs on the VMs of a host service of
 *   `host.blueprint`'s role. Examples: argocd hosted on k3s.server.
 *
 * `roles[]` and `host` are mutually exclusive; exactly one must be present.
 *
 * `placement = "exclusive"` (default) means at most one service of this
 * blueprint may run on a given host (VM for standalone; host service for
 * hosted). Validation lives on the Service write-side, queried by the
 * register handler.
 */
export class Blueprint {
  constructor(
    readonly name: Name,
    readonly description: Description,
    readonly version: SemVer,
    readonly compatibility: Compatibility,
    readonly placement: Placement,
    readonly inputs: readonly Input[],
    readonly roles: readonly Role[],
    readonly host: Host | null,
    readonly installSteps: readonly Step[],
    /** Top-level uninstall steps (hosted blueprints). Standalone puts uninstall
     * steps inside each role's `uninstallSteps`. */
    readonly uninstallSteps: readonly Step[] = [],
  ) {
    const hasRoles = roles.length > 0;
    const hasHost = host !== null;

    if (hasRoles && hasHost) {
      throw new Error(`blueprint '${name.value}': cannot declare both 'roles' and 'host'.`);
    }
    if (!hasRoles && !hasHost) {
      throw new Error(
        `blueprint '${name.value}': must declare either 'roles' (standalone) or 'host' (hosted).`,
      );
    }
    if (hasHost && installSteps.length === 0) {
      throw new Error(`blueprint '${name.value}': hosted blueprint must declare 'install'.`);
    }
    if (hasRoles && installSteps.length > 0) {
      throw new Error(
        `blueprint '${name.value}': standalone puts install steps inside roles, not at the top level.`,
      );
    }
    if (hasRoles && uninstallSteps.length > 0) {
      throw new Error(
        `blueprint '${name.value}': standalone puts uninstall steps inside roles, not at the top level.`,
      );
    }

    if (hasRoles) {
      const seen = new Set<string>();
      for (const role of roles) {
        if (seen.has(role.name)) {
          throw new Error(
            `blueprint '${name.value}': role '${role.name}' is declared more than once.`,
          );
        }
        seen.add(role.name);
      }
    }
  }

  /** True for hosted blueprints (declared with `host`). */
  get isHosted(): boolean {
    return this.host !== null;
  }
}
