import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";

/**
 * The single, standardized channel a Task uses to report progress while
 * it runs.
 *
 * The adapter just `emit`s generic events; it owns none of the wire,
 * buffering or fairness concerns (those live in the implementation, in
 * the executions BC). The runtime decides the terminal: a Task that
 * returns succeeded, that throws failed — adapters never emit terminals
 * or `broadcast` directly.
 */
export interface Emitter {
  emit(event: ExecutionEvent): void;
}
