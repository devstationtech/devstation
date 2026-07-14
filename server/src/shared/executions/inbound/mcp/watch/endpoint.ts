import type { Endpoint } from "@server/shared/inbound/mcp/endpoint/endpoint.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";

/**
 * MCP endpoint `devstation_execution_watch` — blocks until the
 * execution reaches a terminal state, returning every captured event.
 *
 * The RPC counterpart streams events as `execution.event` JSON-RPC
 * notifications; MCP's `tools/call` has no mid-call notification
 * channel, so this adapter drains the AsyncIterable synchronously and
 * returns the events array (`{ result: {}, events: [...] }`). Same
 * shape the legacy `tools/long-running.ts` returned via
 * `gateway.stream`.
 */
export class WatchExecutionMcpEndpoint implements
  Endpoint<
    "devstation_execution_watch",
    { executionId: string },
    { result: Record<string, never>; events: unknown[] }
  > {
  readonly name = "devstation_execution_watch" as const;
  readonly title = "Watch execution";
  readonly description = "Blocks until the execution reaches a terminal state, returning the " +
    "result plus every Log/Step/Succeeded/Failed/Cancelled event.";
  readonly risk = "read" as const;
  readonly inputSchema = {
    type: "object",
    properties: { executionId: { type: "string" } },
    required: ["executionId"],
    additionalProperties: false,
  };

  constructor(private readonly executions: Executions) {}

  async dispatch(
    args: { executionId: string },
  ): Promise<{ result: Record<string, never>; events: unknown[] }> {
    const operation = this.executions.of(args.executionId);
    const events: unknown[] = [];
    for await (const event of operation.watch()) {
      events.push(event);
    }
    return { result: {}, events };
  }
}
