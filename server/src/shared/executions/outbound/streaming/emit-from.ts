import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import type { Emitter } from "@server/shared/executions/domain/ports/outbound/emitter.ts";

/**
 * Bridge for producers still written as event generators: drains an
 * `AsyncIterable<ExecutionEvent>` into an `Emitter` so they
 * satisfy the push-based `Task` contract. Terminals a legacy producer
 * may yield are harmless — the Execution's broadcast keeps the first
 * terminal and ignores the rest, so the runtime's own Succeeded/Failed
 * becomes a no-op when one was already emitted. Remove a call site
 * once its producer emits natively.
 */
export async function emitFrom(
  events: AsyncIterable<ExecutionEvent>,
  emit: Emitter,
): Promise<void> {
  for await (const event of events) emit.emit(event);
}
