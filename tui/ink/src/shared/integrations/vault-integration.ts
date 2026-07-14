import type {
  VaultCreateRequest,
  VaultCreateResponse,
  VaultDeleteRequest,
  VaultDeleteResponse,
  VaultListRequest,
  VaultListResponse,
  VaultRenameRequest,
  VaultRenameResponse,
  VaultSecretsDeleteRequest,
  VaultSecretsDeleteResponse,
  VaultSecretsGenerateRequest,
  VaultSecretsGenerateResponse,
  VaultSecretsListRequest,
  VaultSecretsListResponse,
  VaultSecretsRenameRequest,
  VaultSecretsRenameResponse,
  VaultSecretsRetrieveRequest,
  VaultSecretsRetrieveResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";

/**
 * Integration for the `vault.*` RPC surface.
 *
 * Every method is protected — caller must include a valid sessionId in the
 * Request. The endpoint resolves the session and (for generate/retrieve)
 * uses its encryption key automatically.
 */
export class VaultIntegration {
  constructor(private readonly rpc: Client) {}

  createVault(request: VaultCreateRequest): Promise<VaultCreateResponse> {
    return this.rpc.invoke<VaultCreateResponse>("vault.create", request);
  }

  deleteVault(request: VaultDeleteRequest): Promise<VaultDeleteResponse> {
    return this.rpc.invoke<VaultDeleteResponse>("vault.delete", request);
  }

  renameVault(request: VaultRenameRequest): Promise<VaultRenameResponse> {
    return this.rpc.invoke<VaultRenameResponse>("vault.rename", request);
  }

  listVaults(request: VaultListRequest): Promise<VaultListResponse> {
    return this.rpc.invoke<VaultListResponse>("vault.list", request);
  }

  generateSecret(request: VaultSecretsGenerateRequest): Promise<VaultSecretsGenerateResponse> {
    return this.rpc.invoke<VaultSecretsGenerateResponse>("vault.secrets.generate", request);
  }

  retrieveSecret(request: VaultSecretsRetrieveRequest): Promise<VaultSecretsRetrieveResponse> {
    return this.rpc.invoke<VaultSecretsRetrieveResponse>("vault.secrets.retrieve", request);
  }

  deleteSecret(request: VaultSecretsDeleteRequest): Promise<VaultSecretsDeleteResponse> {
    return this.rpc.invoke<VaultSecretsDeleteResponse>("vault.secrets.delete", request);
  }

  renameSecret(request: VaultSecretsRenameRequest): Promise<VaultSecretsRenameResponse> {
    return this.rpc.invoke<VaultSecretsRenameResponse>("vault.secrets.rename", request);
  }

  listSecrets(request: VaultSecretsListRequest): Promise<VaultSecretsListResponse> {
    return this.rpc.invoke<VaultSecretsListResponse>("vault.secrets.list", request);
  }
}
