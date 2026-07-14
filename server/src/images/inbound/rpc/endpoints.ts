/**
 * Image BC — RPC endpoint catalog.
 *
 * Every method is protected — every operation requires a valid sessionId.
 */
export { RegisterImageEndpoint } from "@server/images/inbound/rpc/register/endpoint.ts";
export { UpdateImageEndpoint } from "@server/images/inbound/rpc/update/endpoint.ts";
export { UnregisterImageEndpoint } from "@server/images/inbound/rpc/unregister/endpoint.ts";
export { ListImagesEndpoint } from "@server/images/inbound/rpc/list/endpoint.ts";
