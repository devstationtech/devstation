import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type { SizeRegisterRequest, SizeRegisterResponse } from "@jsonrpc-contracts-ts/size.gen.ts";
import type { RegisterSizeHandler } from "@server/size/application/handlers/register-size-handler.ts";
import { RegisterSize } from "@server/size/application/commands/register-size.ts";

export class RegisterSizeEndpoint implements
  ProtectedEndpoint<
    "size.register",
    SizeRegisterRequest,
    SizeRegisterResponse
  > {
  readonly method = "size.register" as const;

  constructor(private readonly handler: RegisterSizeHandler) {}

  async dispatch(
    request: SizeRegisterRequest,
  ): Promise<SizeRegisterResponse> {
    await this.handler.handle(
      new RegisterSize(
        request.name,
        request.provider,
        request.cpu,
        request.ram,
        request.disk,
        request.user,
        request.hostname,
      ),
    );
    return {};
  }
}
