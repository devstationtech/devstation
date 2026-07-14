import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { AbortExecution } from "@server/shared/executions/application/commands/abort-execution.ts";

export class AbortExecutionHandler {
  constructor(private readonly executions: Executions) {}

  handle(command: AbortExecution): Promise<void> {
    return this.executions.cancel(command.runId);
  }
}
