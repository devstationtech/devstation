import type { Authentication } from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import type { DispatchContext } from "@server/shared/inbound/rpc/endpoint/dispatch-context.ts";
import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";

/**
 * Wraps a ProtectedEndpoint with session validation. The decorator is
 * applied automatically by `EndpointRegistry.protected()` — clients of
 * the registry never instantiate this directly.
 */
export class Authenticated<M extends string, Request extends { sessionId: string }, Response>
  implements Endpoint<M, Request, Response> {
  constructor(
    private readonly inner: ProtectedEndpoint<M, Request, Response>,
    private readonly authentication: Authentication,
  ) {}

  get method(): M {
    return this.inner.method;
  }

  get streaming(): boolean | undefined {
    return this.inner.streaming;
  }

  async dispatch(request: Request, ctx?: DispatchContext): Promise<Response> {
    const session = this.authentication.check(request.sessionId);
    return await this.inner.dispatch(request, session, ctx);
  }
}
