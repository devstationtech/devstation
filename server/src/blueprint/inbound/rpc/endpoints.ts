/**
 * Blueprint BC — RPC endpoint catalog.
 *
 * Re-exports every endpoint class so the composition root (`src/rpc.ts`)
 * can mount the BC with a single import.
 */
export { ListBlueprintsEndpoint } from "@server/blueprint/inbound/rpc/list/endpoint.ts";
export { BlueprintByIdEndpoint } from "@server/blueprint/inbound/rpc/by-id/endpoint.ts";
export { ValidateBlueprintEndpoint } from "@server/blueprint/inbound/rpc/validate/endpoint.ts";
