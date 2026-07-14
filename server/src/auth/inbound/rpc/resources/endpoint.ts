import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import type {
  AuthResourcesRequest,
  AuthResourcesResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import type { Query as LocalResourcesQuery } from "@server/auth/application/queries/local-resources/query.ts";

/**
 * Endpoint for `auth.resources` — local host CPU/RAM snapshot.
 *
 * Public (no session): the UI header shows it from the first screen,
 * before login. Thin inbound boundary over the existing
 * `LocalResourcesQuery`, a stateful singleton that keeps the previous
 * /proc/stat sample for the delta-based CPU%.
 */
export class ResourcesEndpoint
  implements Endpoint<"auth.resources", AuthResourcesRequest, AuthResourcesResponse> {
  readonly method = "auth.resources" as const;

  constructor(private readonly query: LocalResourcesQuery) {}

  dispatch(_request: AuthResourcesRequest): Promise<AuthResourcesResponse> {
    return this.query.execute();
  }
}
