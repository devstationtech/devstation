import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ClusterImagesListRequest,
  ClusterImagesListResponse,
} from "@jsonrpc-contracts-ts/cluster.gen.ts";
import type { Query as ImagesAllQuery } from "@server/cluster/application/queries/images/all/query.ts";

/**
 * Endpoint `cluster.images.list` — every registered image across
 * clusters, with assignment slots and active VM count.
 */
export class ListImagesEndpoint implements
  ProtectedEndpoint<
    "cluster.images.list",
    ClusterImagesListRequest,
    ClusterImagesListResponse
  > {
  readonly method = "cluster.images.list" as const;

  constructor(private readonly query: ImagesAllQuery) {}

  async dispatch(
    request: ClusterImagesListRequest,
  ): Promise<ClusterImagesListResponse> {
    return await this.query.execute(request.clusterId ?? undefined);
  }
}
