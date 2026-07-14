import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  ImageRegisterRequest,
  ImageRegisterResponse,
} from "@jsonrpc-contracts-ts/image.gen.ts";
import type { RegisterImageHandler } from "@server/images/application/handlers/register-image-handler.ts";
import { RegisterImage } from "@server/images/application/commands/register-image.ts";

export class RegisterImageEndpoint
  implements ProtectedEndpoint<"image.register", ImageRegisterRequest, ImageRegisterResponse> {
  readonly method = "image.register" as const;

  constructor(private readonly handler: RegisterImageHandler) {}

  async dispatch(request: ImageRegisterRequest): Promise<ImageRegisterResponse> {
    await this.handler.handle(
      new RegisterImage(
        request.name,
        request.os,
        request.sourceUrl,
        request.user,
        request.hostname,
      ),
    );
    return {};
  }
}
