import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { ExecutionId } from "@server/shared/executions/domain/models/execution-id.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { Emitter } from "@server/shared/executions/domain/ports/outbound/emitter.ts";
import { Cancelled } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Succeeded } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { Failed } from "@jsonrpc-contracts-ts/executions.gen.ts";
import { InMemoryExecution } from "@server/shared/executions/outbound/in-memory-execution.ts";
import { BufferedEmitter } from "@server/shared/executions/outbound/streaming/buffered-emitter.ts";
import {
  LOG_LATENCY_MS,
  LOG_LINES,
} from "@server/shared/executions/outbound/streaming/log-time-buffer.ts";

type Entry = {
  operation: InMemoryExecution;
  controller: AbortController;
};

/**
 * In-memory implementation of the Executions port.
 *
 * Holds running operations in a process-local Map. Each Execution owns
 * its own AbortController so cancellation can propagate to adapters that
 * read the signal. Events are buffered per-operation so late watchers
 * replay from the beginning.
 *
 * This is the default adapter for single-process installations. A
 * distributed implementation (Redis, durable queue, …) would replace this
 * class without touching application code that depends on the Executions
 * port.
 */
/**
 * Watchdog is disabled by default. An idle-timeout was previously
 * enabled but killed legitimate long-running steps (e.g. k3s install
 * via `curl get.k3s.io | sh`) that produce no output during a binary
 * download — the watchdog fired even though the remote was making real
 * progress.
 *
 * The user can always abort manually via `devstation_execution_cancel` /
 * `execution.cancel` RPC (`InMemoryExecutions.cancel()` is the
 * implementation). Tests can still inject a finite timeout for
 * wedge-detection by passing `idleTimeoutMs` explicitly.
 */
export class InMemoryExecutions implements Executions {
  private readonly items = new Map<ExecutionId, Entry>();

  /**
   * @param idleTimeoutMs Optional; when set, broadcasts `Failed` if no
   *   event AND no settle for this long. Unset (default) = no watchdog
   *   — the task runs to completion or until the user cancels it.
   */
  constructor(private readonly idleTimeoutMs?: number) {}

  start(task: Task): Execution {
    const controller = new AbortController();
    const operation = new InMemoryExecution(crypto.randomUUID(), controller.signal);
    this.items.set(operation.id, { operation, controller });
    void this.consume(operation, task, controller);
    return operation;
  }

  of(id: ExecutionId): Execution {
    return this.require(id).operation;
  }

  async cancel(id: ExecutionId): Promise<void> {
    const entry = this.require(id);
    if (entry.controller.signal.aborted) return;
    entry.controller.abort();
    await entry.operation.broadcast(new Cancelled());
  }

  /** Snapshot of every operation currently tracked (terminated or not). */
  all(): readonly Execution[] {
    return [...this.items.values()].map((e) => e.operation);
  }

  private async consume(
    operation: InMemoryExecution,
    task: Task,
    controller: AbortController,
  ): Promise<void> {
    // Liveness watchdog: opt-in only (see class docstring).
    // When `idleTimeoutMs` is unset, `arm()` is a no-op and the task
    // runs to natural completion or user cancel. When set (mostly
    // tests), broadcasts `Failed` if no event AND no settle for the
    // configured window.
    let idle: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (this.idleTimeoutMs === undefined) return;
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => {
        if (!operation.terminated && !controller.signal.aborted) {
          void operation.broadcast(
            new Failed(`execution stalled — no progress for ${this.idleTimeoutMs}ms`),
          );
        }
      }, this.idleTimeoutMs);
    };

    // The Task emits through here; the runtime owns the terminal (return
    // → Succeeded, throw → Failed, cancel → Cancelled). The buffered
    // emitter hides the log time-buffer; we flush it before broadcasting
    // the terminal.
    const buffered = new BufferedEmitter(
      (event) => {
        if (controller.signal.aborted) return;
        void operation.broadcast(event);
      },
      LOG_LATENCY_MS,
      LOG_LINES,
    );
    // Liveness keys off *producer activity*, not broadcast: a burst of
    // log lines coalesced inside the buffer is still progress, so re-arm
    // on every emit even when the line is held back for fairness.
    const emitter: Emitter = {
      emit: (event) => {
        arm();
        buffered.emit(event);
      },
    };

    try {
      arm();
      await task.run(operation, emitter);
      buffered.flush();
      if (!controller.signal.aborted) await operation.broadcast(new Succeeded());
    } catch (error) {
      buffered.flush();
      if (!controller.signal.aborted) {
        await operation.broadcast(new Failed((error as Error).message));
      }
    } finally {
      if (idle) clearTimeout(idle);
    }
  }

  private require(id: ExecutionId): Entry {
    const entry = this.items.get(id);
    if (!entry) throw new Error(`operation not found: ${id}`);
    return entry;
  }
}
