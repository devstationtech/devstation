import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { ExecutionEvent } from "@server/shared/executions/domain/events/event.ts";

export class Query {
  constructor(private readonly executions: Executions) {}

  execute(runId: string): Promise<AsyncIterable<ExecutionEvent>> {
    return Promise.resolve(this.executions.of(runId).watch());
  }
}
