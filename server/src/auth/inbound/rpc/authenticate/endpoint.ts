import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import type {
  AuthAuthenticateRequest,
  AuthAuthenticateResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import type { AuthenticateHandler } from "@server/auth/application/handlers/authenticate-handler.ts";
import { Authenticate } from "@server/auth/application/commands/authenticate.ts";

/**
 * Endpoint for `auth.authenticate` — verifies the master password and
 * opens a new session.
 */
export class AuthenticateEndpoint
  implements Endpoint<"auth.authenticate", AuthAuthenticateRequest, AuthAuthenticateResponse> {
  readonly method = "auth.authenticate" as const;

  constructor(private readonly handler: AuthenticateHandler) {}

  async dispatch(request: AuthAuthenticateRequest): Promise<AuthAuthenticateResponse> {
    const session = await this.handler.handle(new Authenticate(request.password));
    return {
      sessionId: session.id.value,
      expiresAt: session.expiresAt.at.date.toISOString(),
    };
  }
}
