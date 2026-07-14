import type {
  AuthAuthenticateRequest,
  AuthAuthenticateResponse,
  AuthConfiguredRequest,
  AuthConfiguredResponse,
  AuthConfigureRequest,
  AuthConfigureResponse,
  AuthRenewRequest,
  AuthRenewResponse,
  AuthResourcesRequest,
  AuthResourcesResponse,
  AuthTokenCurrentRequest,
  AuthTokenCurrentResponse,
  AuthTokenGenerateRequest,
  AuthTokenGenerateResponse,
  AuthTokenRevokeRequest,
  AuthTokenRevokeResponse,
} from "@jsonrpc-contracts-ts/auth.gen.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";

/**
 * Integration for the `auth.*` RPC surface.
 *
 * Represents a local SDK — the runtime glue that knows how to call the
 * server's auth methods with typed Request/Response. React-agnostic (no
 * hooks, no Ink, no DOM); the Provider in `rpc-clients-provider.tsx` wires
 * it into the React tree.
 *
 * When a second TS UI appears (Electron, web), evaluate whether to promote
 * `shared/integrations/` to a shared package — until then, per-UI copies
 * are cheaper than premature abstraction.
 */
export class AuthIntegration {
  constructor(private readonly rpc: Client) {}

  configured(request: AuthConfiguredRequest = {}): Promise<AuthConfiguredResponse> {
    return this.rpc.invoke<AuthConfiguredResponse>("auth.configured", request);
  }

  configure(request: AuthConfigureRequest): Promise<AuthConfigureResponse> {
    return this.rpc.invoke<AuthConfigureResponse>("auth.configure", request);
  }

  resources(request: AuthResourcesRequest = {}): Promise<AuthResourcesResponse> {
    return this.rpc.invoke<AuthResourcesResponse>("auth.resources", request);
  }

  authenticate(request: AuthAuthenticateRequest): Promise<AuthAuthenticateResponse> {
    return this.rpc.invoke<AuthAuthenticateResponse>("auth.authenticate", request);
  }

  renew(request: AuthRenewRequest): Promise<AuthRenewResponse> {
    return this.rpc.invoke<AuthRenewResponse>("auth.renew", request);
  }

  generateToken(request: AuthTokenGenerateRequest): Promise<AuthTokenGenerateResponse> {
    return this.rpc.invoke<AuthTokenGenerateResponse>("auth.token.generate", request);
  }

  currentToken(request: AuthTokenCurrentRequest): Promise<AuthTokenCurrentResponse> {
    return this.rpc.invoke<AuthTokenCurrentResponse>("auth.token.current", request);
  }

  revokeToken(request: AuthTokenRevokeRequest): Promise<AuthTokenRevokeResponse> {
    return this.rpc.invoke<AuthTokenRevokeResponse>("auth.token.revoke", request);
  }
}
