import type { McpPrompt } from "@server/shared/inbound/mcp/prompts/mcp-prompt.ts";

/**
 * Production MCP prompts. **Generic only** — anything tied to the
 * `@mcp-test-harness` smoke flow lives in
 * `libs/mcp-test-harness-ts/src/prompts/` and is not exposed by the
 * production server (would leak test scaffolding into a feature port).
 *
 * `devstation-diagnose-execution` is the one prompt that's useful to
 * any agent driving the MCP — given an executionId, walk the events
 * and propose a fix. No harness coupling.
 */
export const prompts: McpPrompt[] = [
  {
    name: "devstation-diagnose-execution",
    description: "Diagnose a failed execution from its stream/logs.",
    text: "Given an executionId, read `devstation://executions/<id>` (or " +
      "`devstation_execution_list`), correlate Log/Step/Failed events, state " +
      "the most likely root cause and the smallest safe fix.",
  },
];
