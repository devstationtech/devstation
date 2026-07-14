import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";

/**
 * MCP endpoint `devstation_execution_list` — snapshot of every
 * tracked execution. Returns just the id (matches the RPC counterpart).
 * Future iterations may enrich with kind/status/started.
 */
export class ListExecutionsMcpEndpoint implements
  Endpoint<
    "devstation_execution_list",
    Record<string, never>,
    Array<{ id: string }>
  > {
  readonly name = "devstation_execution_list" as const;
  readonly title = "List executions";
  readonly description = "Known executions.";
  readonly risk = "read" as const;
  readonly inputSchema = { type: "object", properties: {}, additionalProperties: false };

  constructor(private readonly executions: Executions) {}

  dispatch(): Array<{ id: string }> {
    return this.executions.all().map((op) => ({ id: op.id }));
  }
}
