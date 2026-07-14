import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import type {
  StationServicesRegisterRequest,
  StationServicesRegisterResponse,
} from "@jsonrpc-contracts-ts/station.gen.ts";
import type { RegisterServiceHandler } from "@server/station/application/handlers/register-service-handler.ts";
import { RegisterService } from "@server/station/application/commands/register-service.ts";

/**
 * Endpoint `station.services.register` — registers a service inside an
 * existing station. `instances` is for standalone blueprints, `host` is for
 * hosted blueprints — the handler enforces the mutual exclusion.
 */
export class RegisterServiceEndpoint implements
  ProtectedEndpoint<
    "station.services.register",
    StationServicesRegisterRequest,
    StationServicesRegisterResponse
  > {
  readonly method = "station.services.register" as const;

  constructor(private readonly handler: RegisterServiceHandler) {}

  async dispatch(
    request: StationServicesRegisterRequest,
  ): Promise<StationServicesRegisterResponse> {
    await this.handler.handle(
      new RegisterService(
        request.stationId,
        request.name,
        request.blueprint,
        request.vaultId,
        { ...request.inputs },
        { ...request.secrets },
        request.user,
        request.hostname,
        request.instances ? request.instances.map((i) => ({ ...i })) : null,
        request.host ? { ...request.host } : null,
      ),
    );
    return {};
  }
}
