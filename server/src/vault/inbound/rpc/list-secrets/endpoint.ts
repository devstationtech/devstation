import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  VaultSecretsListRequest,
  VaultSecretsListResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { Query as AllSecretsQuery } from "@server/vault/application/queries/secrets/all/query.ts";

export class ListSecretsEndpoint
  implements
    ProtectedEndpoint<"vault.secrets.list", VaultSecretsListRequest, VaultSecretsListResponse> {
  readonly method = "vault.secrets.list" as const;

  constructor(private readonly query: AllSecretsQuery) {}

  async dispatch(request: VaultSecretsListRequest): Promise<VaultSecretsListResponse> {
    return await this.query.execute(request.vaultId);
  }
}
