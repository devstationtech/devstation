/**
 * Vault BC — MCP endpoint catalog.
 */
export { CreateVaultMcpEndpoint } from "@server/vault/inbound/mcp/create-vault/endpoint.ts";
export { DeleteVaultMcpEndpoint } from "@server/vault/inbound/mcp/delete-vault/endpoint.ts";
export { ListVaultsMcpEndpoint } from "@server/vault/inbound/mcp/list-vaults/endpoint.ts";
export { GenerateSecretMcpEndpoint } from "@server/vault/inbound/mcp/generate-secret/endpoint.ts";
export { DeleteSecretMcpEndpoint } from "@server/vault/inbound/mcp/delete-secret/endpoint.ts";
export { ListSecretsMcpEndpoint } from "@server/vault/inbound/mcp/list-secrets/endpoint.ts";
export { RenameVaultMcpEndpoint } from "@server/vault/inbound/mcp/rename-vault/endpoint.ts";
export { RenameSecretMcpEndpoint } from "@server/vault/inbound/mcp/rename-secret/endpoint.ts";
