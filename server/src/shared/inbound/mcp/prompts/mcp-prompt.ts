/**
 * MCP `prompts/list` + `prompts/get` payload. Static instruction
 * templates the server can offer agents (no params; static text).
 * The MCP SDK calls these "prompts" — we keep the wire term here.
 */
export interface McpPrompt {
  readonly name: string;
  readonly description: string;
  readonly text: string;
}
