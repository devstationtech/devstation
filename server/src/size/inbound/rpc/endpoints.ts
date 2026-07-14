/**
 * Size BC — RPC endpoint catalog.
 *
 * Every method is protected — every operation requires a valid sessionId.
 */
export { RegisterSizeEndpoint } from "@server/size/inbound/rpc/register/endpoint.ts";
export { UnregisterSizeEndpoint } from "@server/size/inbound/rpc/unregister/endpoint.ts";
export { ListSizesEndpoint } from "@server/size/inbound/rpc/list/endpoint.ts";
