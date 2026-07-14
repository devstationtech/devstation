import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { ImageUpdateRequest, ImageUpdateResponse } from "@jsonrpc-contracts-ts/image.gen.ts";
import type { UpdateImageHandler } from "@server/images/application/handlers/update-image-handler.ts";
import { UpdateImage } from "@server/images/application/commands/update-image.ts";

export class UpdateImageEndpoint
  implements ProtectedEndpoint<"image.update", ImageUpdateRequest, ImageUpdateResponse> {
  readonly method = "image.update" as const;

  constructor(private readonly handler: UpdateImageHandler) {}

  async dispatch(request: ImageUpdateRequest): Promise<ImageUpdateResponse> {
    await this.handler.handle(
      new UpdateImage(request.id, request.name, request.os, request.sourceUrl),
    );
    return {};
  }
}
