import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  SizeUnregisterRequest,
  SizeUnregisterResponse,
} from "@jsonrpc-contracts-ts/size.gen.ts";
import type { UnregisterSizeHandler } from "@server/size/application/handlers/unregister-size-handler.ts";
import { UnregisterSize } from "@server/size/application/commands/unregister-size.ts";

export class UnregisterSizeEndpoint implements
  ProtectedEndpoint<
    "size.unregister",
    SizeUnregisterRequest,
    SizeUnregisterResponse
  > {
  readonly method = "size.unregister" as const;

  constructor(private readonly handler: UnregisterSizeHandler) {}

  async dispatch(
    request: SizeUnregisterRequest,
  ): Promise<SizeUnregisterResponse> {
    await this.handler.handle(new UnregisterSize(request.sizeId));
    return {};
  }
}
