import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import type { AuthRenewRequest, AuthRenewResponse } from "@jsonrpc-contracts-ts/auth.gen.ts";
import type { RenewHandler } from "@server/auth/application/handlers/renew-handler.ts";
import { Renew } from "@server/auth/application/commands/renew.ts";

/**
 * Endpoint for `auth.renew` — refreshes an existing session before it expires.
 */
export class RenewEndpoint implements Endpoint<"auth.renew", AuthRenewRequest, AuthRenewResponse> {
  readonly method = "auth.renew" as const;

  constructor(private readonly handler: RenewHandler) {}

  async dispatch(request: AuthRenewRequest): Promise<AuthRenewResponse> {
    const session = await this.handler.handle(new Renew(request.sessionId));
    return {
      sessionId: session.id.value,
      expiresAt: session.expiresAt.at.date.toISOString(),
    };
  }
}
