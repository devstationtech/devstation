import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { VaultListRequest, VaultListResponse } from "@jsonrpc-contracts-ts/vault.gen.ts";
import type { Query as AllVaultsQuery } from "@server/vault/application/queries/all/query.ts";

export class ListVaultsEndpoint
  implements ProtectedEndpoint<"vault.list", VaultListRequest, VaultListResponse> {
  readonly method = "vault.list" as const;

  constructor(private readonly query: AllVaultsQuery) {}

  async dispatch(_request: VaultListRequest): Promise<VaultListResponse> {
    return await this.query.execute();
  }
}
