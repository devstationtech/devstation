/**
 * Executions RPC endpoint catalog.
 *
 * Every method is protected — every operation requires a valid sessionId.
 * These endpoints are registered ONCE at the composition root; BCs that
 * emit long-running work just plug their Tasks into the `Executions` port
 * and the existing watch/cancel/list endpoints handle the rest.
 */
export { WatchEndpoint } from "@server/shared/executions/inbound/rpc/watch/endpoint.ts";
export { CancelEndpoint } from "@server/shared/executions/inbound/rpc/cancel/endpoint.ts";
export { ListEndpoint } from "@server/shared/executions/inbound/rpc/list/endpoint.ts";
