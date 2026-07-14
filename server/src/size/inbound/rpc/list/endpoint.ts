import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { SizeListRequest, SizeListResponse } from "@jsonrpc-contracts-ts/size.gen.ts";
import type { Query as AllSizesQuery } from "@server/size/application/queries/all/query.ts";

export class ListSizesEndpoint implements
  ProtectedEndpoint<
    "size.list",
    SizeListRequest,
    SizeListResponse
  > {
  readonly method = "size.list" as const;

  constructor(private readonly query: AllSizesQuery) {}

  async dispatch(_request: SizeListRequest): Promise<SizeListResponse> {
    return await this.query.execute();
  }
}
