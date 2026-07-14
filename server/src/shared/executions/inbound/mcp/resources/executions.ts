import type { Resource } from "@server/shared/inbound/mcp/resource/resource.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";

/**
 * MCP resource `devstation://executions` — snapshot of every tracked
 * execution. Read-only counterpart to `devstation_execution_list`.
 */
export class ExecutionsResource implements Resource {
  readonly uri = "devstation://executions" as const;
  readonly name = "executions" as const;
  readonly description = "Known executions";

  constructor(private readonly executions: Executions) {}

  read(): Array<{ id: string }> {
    return this.executions.all().map((op) => ({ id: op.id }));
  }
}
