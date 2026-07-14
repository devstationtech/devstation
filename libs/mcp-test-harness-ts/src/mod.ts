/**
 * @mcp-test-harness — a minimal, reusable client for driving any MCP stdio
 * server from a test. Project-agnostic: it knows nothing about a specific
 * server or its tools.
 *
 * `McpClient.spawn({ serverCmd })` launches the server as a subprocess and
 * speaks newline-delimited JSON-RPC; `call`/`parsed`/`readResource` invoke
 * tools and read resources. Tests orchestrate it directly (e.g. with
 * `describe/it` + `@std/assert`) — no scenario DSL, no bundled reporting.
 */
export { McpClient } from "./client.ts";
export type { CallResult, SpawnOptions } from "./client.ts";
