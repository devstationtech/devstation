import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ImageUnregisterRequest,
  ImageUnregisterResponse,
} from "@jsonrpc-contracts-ts/image.gen.ts";
import type { UnregisterImageHandler } from "@server/images/application/handlers/unregister-image-handler.ts";
import { UnregisterImage } from "@server/images/application/commands/unregister-image.ts";

export class UnregisterImageEndpoint
  implements
    ProtectedEndpoint<"image.unregister", ImageUnregisterRequest, ImageUnregisterResponse> {
  readonly method = "image.unregister" as const;

  constructor(private readonly handler: UnregisterImageHandler) {}

  async dispatch(request: ImageUnregisterRequest): Promise<ImageUnregisterResponse> {
    await this.handler.handle(new UnregisterImage(request.id));
    return {};
  }
}
