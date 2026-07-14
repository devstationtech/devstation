import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { Blueprint } from "@server/station/domain/contracts/blueprint.ts";
import type { Role } from "@server/station/domain/models/service/role.ts";
import type { InputValue } from "@server/station/domain/models/service/inputs.ts";
import type { Installation } from "@server/station/domain/models/service/installation.ts";

/**
 * One service instance, fully resolved for the installer: SSH user +
 * the role this instance fills in the topology. The installer connects
 * via the shared CLI key identity; the vault password stored against
 * this instance is NOT consumed here — it stays in the vault for the
 * user's own manual access.
 */
export type ResolvedInstance = {
  readonly role: Role;
  readonly host: string;
  readonly user: string;
};

/**
 * Everything the installer needs to run one full service install. Resolution
 * (vault → plaintext) happens in the handler before the installer is called;
 * the installer is pure orchestration + transport.
 */
export type InstallContext = {
  readonly blueprint: Blueprint;
  readonly inputs: Readonly<Record<string, InputValue>>;
  readonly secrets: Readonly<Record<string, string>>;
  readonly instances: readonly ResolvedInstance[];
};

/**
 * Provider-agnostic contract for executing a service install. Implementations
 * (e.g. `ProxmoxInstaller`) read `stack.kind` and orchestrate accordingly:
 * single → run `stack.steps` against the single instance; clustered →
 * iterate `stack.roles` in order, running each role's steps for every
 * matching instance, propagating `ctx.fromRole` peers between roles.
 *
 * Same shape as any other long execution — a `Task` — only it produces a
 * domain result: the `Installation[]` (one entry per instance) returned
 * when `run` resolves. Streams logs/steps via the emitter; never emits
 * terminals (the runtime / in-process orchestrator owns them); a failure
 * is a thrown error, exactly like the provisioning Task. It is consumed
 * in-process by `runServiceInstall`, never handed to `Executions.start`.
 */
export interface Installer {
  install(ctx: InstallContext): Task<readonly Installation[]>;
  /**
   * Tears a service down: runs the blueprint's `uninstall` steps per instance,
   * in reverse role order. Same Task shape as `install` — streams Log/Step,
   * throws on failure, honors the aborted signal — but produces no domain
   * result (the torn-down installations come from the service's own state).
   * Tolerates an unreachable host (the VM may already be gone) as
   * already-uninstalled.
   */
  uninstall(ctx: InstallContext): Task<void>;
}
