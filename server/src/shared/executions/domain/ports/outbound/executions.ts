import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { ExecutionId } from "@server/shared/executions/domain/models/execution-id.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";

/**
 * Long-running operations runtime — starts and tracks operations.
 *
 * Responsibilities:
 * - Start a task and return the resulting Execution handle.
 * - Look up an existing Execution by its id.
 * - Cancel a running Execution (best-effort, per AIP-151).
 * - List every tracked Execution (snapshot for observability).
 *
 * Consumers receive an Execution (read handle) but only this port creates
 * or cancels one. Lifecycle stays under a single owner.
 *
 * Naming follows Google's AIP-151 long-running operations pattern.
 */
export interface Executions {
  /** Start a task. Returns a handle to the running Execution. */
  start(task: Task): Execution;

  /** Retrieve an existing Execution by its id. Throws if not found. */
  of(id: ExecutionId): Execution;

  /** Cancel a running Execution. No-op if already terminated. Best-effort. */
  cancel(id: ExecutionId): Promise<void>;

  /** Snapshot of every tracked Execution (in-flight or terminated). */
  all(): readonly Execution[];
}
