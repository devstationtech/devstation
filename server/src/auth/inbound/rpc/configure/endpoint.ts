import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import type {
  AuthConfigureRequest,
  AuthConfigureResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import type { ConfigureHandler } from "@server/auth/application/handlers/configure-handler.ts";
import { Configure } from "@server/auth/application/commands/configure.ts";

/**
 * Endpoint for `auth.configure` — sets the master password for first-time
 * setup and returns the initial session.
 *
 * Receives the JSON request from the RPC port, instantiates the domain
 * Command, invokes the Handler, and shapes the Response back to the client.
 * No intermediate Action wrapper — the endpoint IS the inbound boundary.
 */
export class ConfigureEndpoint
  implements Endpoint<"auth.configure", AuthConfigureRequest, AuthConfigureResponse> {
  readonly method = "auth.configure" as const;

  constructor(private readonly handler: ConfigureHandler) {}

  async dispatch(request: AuthConfigureRequest): Promise<AuthConfigureResponse> {
    const session = await this.handler.handle(new Configure(request.password));
    return {
      sessionId: session.id.value,
      expiresAt: session.expiresAt.at.date.toISOString(),
    };
  }
}
