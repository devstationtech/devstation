/**
 * Thrown by `McpPolicy` guards when a destructive/long-running call
 * targets a resource that does not satisfy the configured prefix /
 * allowlist. The tool layer converts this into an `isError` MCP
 * `tools/call` result with the exception message preserved verbatim.
 */
export class PolicyViolation extends Error {}
