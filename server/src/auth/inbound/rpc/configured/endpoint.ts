import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import type {
  AuthConfiguredRequest,
  AuthConfiguredResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import type { Query as IsAuthConfiguredQuery } from "@server/auth/application/queries/configured/query.ts";

/**
 * Endpoint for `auth.configured` — reports whether the master password
 * has already been set. Public (no session): the auth gate calls it
 * before any session exists to choose between first-time setup and login.
 *
 * Thin inbound boundary over the existing `IsAuthConfiguredQuery`
 * (checks the `.salt` file). No Action wrapper — the endpoint IS the
 * boundary.
 */
export class ConfiguredEndpoint
  implements Endpoint<"auth.configured", AuthConfiguredRequest, AuthConfiguredResponse> {
  readonly method = "auth.configured" as const;

  constructor(private readonly query: IsAuthConfiguredQuery) {}

  dispatch(_request: AuthConfiguredRequest): Promise<AuthConfiguredResponse> {
    return this.query.execute();
  }
}
