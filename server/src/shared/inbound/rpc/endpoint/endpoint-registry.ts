import type { Authentication } from "@server/shared/authentication/domain/ports/outbound/authentication.ts";
import type { Endpoint } from "@server/shared/inbound/rpc/endpoint/endpoint.ts";
import type { ProtectedEndpoint } from "@server/shared/inbound/rpc/endpoint/protected-endpoint.ts";
import { Authenticated } from "@server/shared/inbound/rpc/endpoint/authenticated.ts";

// deno-lint-ignore no-explicit-any
type AnyEndpoint = Endpoint<string, any, any>;
// deno-lint-ignore no-explicit-any
type AnyProtectedEndpoint = ProtectedEndpoint<string, any, any>;

/**
 * Routes RPC method names to their Endpoint implementations.
 *
 * Two registration paths declare intent at composition time:
 *
 *   .public(endpoint)            — no session check
 *   .protected(endpoint)         — wraps with Authenticated decorator
 *
 * Forgetting to call `.protected()` does NOT silently leave a method open
 * — the type system requires `ProtectedEndpoint` for `.protected()` and
 * `Endpoint` for `.public()`. A protected endpoint registered as public
 * fails type checking (its dispatch takes 2 args, public takes 1).
 */
export class EndpointRegistry {
  private readonly entries = new Map<string, AnyEndpoint>();

  static empty(authentication: Authentication): EndpointRegistry {
    return new EndpointRegistry(authentication);
  }

  private constructor(private readonly authentication: Authentication) {}

  public(endpoint: AnyEndpoint): this {
    this.add(endpoint);
    return this;
  }

  protected(endpoint: AnyProtectedEndpoint): this {
    this.add(new Authenticated(endpoint, this.authentication));
    return this;
  }

  find(method: string): AnyEndpoint | undefined {
    return this.entries.get(method);
  }

  private add(endpoint: AnyEndpoint): void {
    if (this.entries.has(endpoint.method)) {
      throw new Error(`duplicate endpoint: ${endpoint.method}`);
    }
    this.entries.set(endpoint.method, endpoint);
  }
}
