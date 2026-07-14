import type { McpPolicy } from "@server/shared/inbound/mcp/policy/mcp-policy.ts";

/**
 * Runtime context handed to every `Endpoint.dispatch`. Carries the
 * configured safety policy. Built once per server boot in
 * `buildMcpServer` and passed through to every dispatch unchanged.
 *
 * No per-session auth field: the access gate is whole-endpoint at
 * registration time (`EndpointRegistry.protected`), not per-call, so
 * dispatch needs no session handle.
 */
export interface DispatchContext {
  readonly policy: McpPolicy;
}
