import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";

/**
 * MCP endpoint `devstation_execution_cancel` — best-effort
 * cancellation (AIP-151). Returns an empty Ack immediately; the
 * terminal `Cancelled` event arrives on any active `execution_watch`
 * for the same id.
 */
export class CancelExecutionMcpEndpoint implements
  Endpoint<
    "devstation_execution_cancel",
    { executionId: string },
    Record<string, never>
  > {
  readonly name = "devstation_execution_cancel" as const;
  readonly title = "Cancel execution";
  readonly description = "Requests cancellation of a running execution.";
  readonly risk = "mutating" as const;
  readonly inputSchema = {
    type: "object",
    properties: { executionId: { type: "string" } },
    required: ["executionId"],
    additionalProperties: false,
  };

  constructor(private readonly executions: Executions) {}

  async dispatch(args: { executionId: string }): Promise<Record<string, never>> {
    await this.executions.cancel(args.executionId);
    return {};
  }
}
