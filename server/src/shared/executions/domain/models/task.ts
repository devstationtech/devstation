import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { Emitter } from "@server/shared/executions/domain/ports/outbound/emitter.ts";

/**
 * A unit of asynchronous work that reports progress as it runs and
 * resolves with a result of type `R` (`void` by default).
 *
 * Tasks are built by outbound adapters (factory pattern): the adapter
 * binds its arguments and returns a Task. The Executions runtime calls
 * `run(operation, emitter)` once.
 *
 * The task reads the operation's signal to stop external work when the
 * operation is cancelled, and emits progress events. It never emits
 * terminals or broadcasts directly — the runtime owns the terminal:
 * a normal return becomes `Succeeded`, a thrown error becomes `Failed`,
 * a cancelled signal becomes `Cancelled`.
 *
 * `R` is the typed result channel for tasks that produce a domain value
 * the caller needs (e.g. a install yielding `Installation[]`). A `Task` the
 * runtime owns (`Executions.start`) is `Task<void>`; the result channel
 * is for tasks consumed in-process by an orchestrator. This is the only
 * structural difference between a streaming-only task (provisioning) and a
 * result-producing one (installer) — everything else is identical.
 */
export interface Task<R = void> {
  run(operation: Execution, emitter: Emitter): Promise<R>;
}
