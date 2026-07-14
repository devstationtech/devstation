/**
 * Plain JSON Schema — what MCP clients receive via `tools/list`. Kept
 * loose; the application handlers validate the actual params.
 *
 * Lives at the top of `mcp/` (not under `endpoint/` or `tools/`) because
 * it's a wire-level primitive shared by every adapter type.
 */
export type JsonSchema = Record<string, unknown>;
