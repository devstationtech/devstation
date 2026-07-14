import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { ExecutionId } from "@server/shared/executions/domain/models/execution-id.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";
import { isTerminal } from "@server/shared/executions/domain/events/terminal.ts";

export class InMemoryExecution implements Execution {
  private readonly buffer: ExecutionEvent[] = [];
  private waiting = Promise.withResolvers<void>();
  private closed = false;

  constructor(readonly id: ExecutionId, readonly signal: AbortSignal) {}

  /** True once a terminal event has been broadcast. */
  get terminated(): boolean {
    return this.closed;
  }

  async broadcast(event: ExecutionEvent): Promise<void> {
    if (this.closed) return;
    this.buffer.push(event);
    if (isTerminal(event)) this.closed = true;
    const previous = this.waiting;
    this.waiting = Promise.withResolvers<void>();
    previous.resolve();
    await Promise.resolve();
  }

  async *watch(): AsyncIterable<ExecutionEvent> {
    let cursor = 0;
    while (true) {
      while (cursor < this.buffer.length) {
        const event = this.buffer[cursor++];
        yield event;
        if (isTerminal(event)) return;
      }
      if (this.closed) return;
      await this.waiting.promise;
    }
  }
}
