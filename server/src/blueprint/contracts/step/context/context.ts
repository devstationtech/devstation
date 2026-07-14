import type { Inputs } from "@server/blueprint/contracts/step/context/inputs.ts";
import type { Secrets } from "@server/blueprint/contracts/step/context/secrets.ts";
import type { Ssh } from "@server/blueprint/contracts/step/context/ssh.ts";
import type { RoleHandle } from "@server/blueprint/contracts/step/context/role-handle.ts";

/**
 * Runtime context passed to every step's `apply` and `verify` function.
 * Built by the installer adapter; stack authors only consume it. Composes
 * the ambient capabilities a step has access to: `inputs` (validated user
 * values), `secrets` (read+publish), `ssh` (transport), `role` identity,
 * and `fromRole(name)` for peers from previously-installed roles.
 */
export interface Context {
  readonly inputs: Inputs;
  readonly secrets: Secrets;
  readonly ssh: Ssh;
  readonly role: { readonly name: string };
  /** Host the step is currently executing against (the instance's IP/hostname). */
  readonly host: string;
  fromRole(name: string): RoleHandle;
}
