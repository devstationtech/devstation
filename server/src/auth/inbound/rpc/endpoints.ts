/**
 * Auth BC — RPC endpoint catalog.
 *
 * Re-exports every endpoint class so the composition root (`src/rpc.ts`)
 * can mount the BC with a single import.
 */
export { ConfiguredEndpoint } from "@server/auth/inbound/rpc/configured/endpoint.ts";
export { ResourcesEndpoint } from "@server/auth/inbound/rpc/resources/endpoint.ts";
export { ConfigureEndpoint } from "@server/auth/inbound/rpc/configure/endpoint.ts";
export { AuthenticateEndpoint } from "@server/auth/inbound/rpc/authenticate/endpoint.ts";
export { RenewEndpoint } from "@server/auth/inbound/rpc/renew/endpoint.ts";
export { GenerateTokenEndpoint } from "@server/auth/inbound/rpc/token/generate/endpoint.ts";
export { CurrentTokenEndpoint } from "@server/auth/inbound/rpc/token/current/endpoint.ts";
export { RevokeTokenEndpoint } from "@server/auth/inbound/rpc/token/revoke/endpoint.ts";
