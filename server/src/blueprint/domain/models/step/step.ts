import type { Id } from "@server/blueprint/domain/models/step/id.ts";
import type { Description } from "@server/blueprint/domain/models/step/description.ts";
import type { Verify } from "@server/blueprint/domain/models/step/verify.ts";
import type { Publish } from "@server/blueprint/domain/models/step/publish.ts";

/**
 * A unit of work declared by a blueprint. Pure descriptor — the installer
 * knows how to interpret these fields against an SSH context.
 *
 * - `shell`: the command body to execute. May reference templating tokens
 *   (`${inputs.X}`, `${secrets.X}`, `${peer.role[N].X}`, `${role}`,
 *   `${host}`); the installer resolves them per host before running.
 * - `env`: variables exported before `shell` runs. Values support templating.
 * - `verify`: optional health probe. When healthy, the installer skips the step.
 * - `publish`: values captured after a successful run (secrets + facts).
 * - `rollback`: optional shell to run when `shell` fails.
 */
export class Step {
  constructor(
    readonly id: Id,
    readonly description: Description,
    readonly shell: string,
    readonly env: Readonly<Record<string, string>>,
    readonly verify: Verify | null,
    readonly publish: Publish,
    readonly rollback: string | null,
  ) {
    if (!shell) throw new Error(`step '${id.value}': shell is required.`);
  }
}
