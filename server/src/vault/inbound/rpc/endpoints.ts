/**
 * Vault BC — RPC endpoint catalog.
 *
 * Every method is protected (every operation requires a valid sessionId).
 * Two endpoints (generate-secret, retrieve-secret) also use the session's
 * encryption key passed via the AuthenticatedSession second-dispatch-arg.
 */
export { CreateVaultEndpoint } from "@server/vault/inbound/rpc/create-vault/endpoint.ts";
export { DeleteVaultEndpoint } from "@server/vault/inbound/rpc/delete-vault/endpoint.ts";
export { ListVaultsEndpoint } from "@server/vault/inbound/rpc/list-vaults/endpoint.ts";
export { GenerateSecretEndpoint } from "@server/vault/inbound/rpc/generate-secret/endpoint.ts";
export { RetrieveSecretEndpoint } from "@server/vault/inbound/rpc/retrieve-secret/endpoint.ts";
export { DeleteSecretEndpoint } from "@server/vault/inbound/rpc/delete-secret/endpoint.ts";
export { ListSecretsEndpoint } from "@server/vault/inbound/rpc/list-secrets/endpoint.ts";
export { RenameVaultEndpoint } from "@server/vault/inbound/rpc/rename-vault/endpoint.ts";
export { RenameSecretEndpoint } from "@server/vault/inbound/rpc/rename-secret/endpoint.ts";
