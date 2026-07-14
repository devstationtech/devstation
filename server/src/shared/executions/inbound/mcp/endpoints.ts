/**
 * Executions sub-BC — MCP endpoint catalog.
 *
 * Cross-cutting execution control surfaces (watch/cancel/list) — every
 * long-running cluster/station op returns an `executionId` that the
 * agent feeds back into these.
 */
export { WatchExecutionMcpEndpoint } from "@server/shared/executions/inbound/mcp/watch/endpoint.ts";
export { CancelExecutionMcpEndpoint } from "@server/shared/executions/inbound/mcp/cancel/endpoint.ts";
export { ListExecutionsMcpEndpoint } from "@server/shared/executions/inbound/mcp/list/endpoint.ts";
// Resources
export { ExecutionsResource } from "@server/shared/executions/inbound/mcp/resources/executions.ts";
