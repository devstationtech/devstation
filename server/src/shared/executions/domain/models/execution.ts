import type { ExecutionId } from "@server/shared/executions/domain/models/execution-id.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";

/**
 * A running instance of a task.
 *
 * Holds the identifier, the abort signal, and exposes the event stream
 * that consumers can watch. Execution is a read-only handle: it cannot
 * be started or cancelled through this interface — that is the Executions
 * port's job. Adapters read the signal to stop external work when the
 * operation is cancelled.
 */
export interface Execution {
  /** Unique identifier of this operation. */
  readonly id: ExecutionId;

  /** Abort signal. Becomes aborted when the operation is cancelled. */
  readonly signal: AbortSignal;

  /**
   * Subscribe to the operation's event stream.
   * Yields every event produced so far, then future events as they
   * arrive, until a terminal event (Succeeded, Failed or Cancelled) closes it.
   */
  watch(): AsyncIterable<ExecutionEvent>;
}
