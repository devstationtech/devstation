import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { ImageListRequest, ImageListResponse } from "@jsonrpc-contracts-ts/image.gen.ts";
import type { Query as AllImagesQuery } from "@server/images/application/queries/all/query.ts";

export class ListImagesEndpoint
  implements ProtectedEndpoint<"image.list", ImageListRequest, ImageListResponse> {
  readonly method = "image.list" as const;

  constructor(private readonly query: AllImagesQuery) {}

  async dispatch(_request: ImageListRequest): Promise<ImageListResponse> {
    return await this.query.execute();
  }
}
