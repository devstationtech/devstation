// AUTO-GENERATED from @jsonrpc-schemas/auth.openrpc.json
// Do not edit by hand — run `deno task contracts:codegen`.

/** A stored MCP access token, key material excluded — safe to show. */
export class AuthTokenSummary {
  constructor(
    readonly id: string,
    readonly purpose: string,
    readonly scopes: ReadonlyArray<string>,
    readonly createdAt: string,
    /** ISO 8601, or null when the token never expires. */
    readonly expiresAt: string | null,
  ) {}
}

/** Whether an MCP access token is configured; the summary fields are present only when it is. */
export class AuthTokenState {
  constructor(
    readonly present: boolean,
    readonly id?: string,
    readonly purpose?: string,
    readonly scopes?: ReadonlyArray<string>,
    readonly createdAt?: string,
    readonly expiresAt?: string | null,
  ) {}
}

/** Result of a revoke call. */
export class AuthTokenRevoked {
  constructor(
    readonly revoked: boolean,
  ) {}
}

/** Local host resource snapshot (0..100). cpuPercent is delta-based; the first call after server start returns 0. */
export class AuthResources {
  constructor(
    readonly cpuPercent: number,
    readonly ramPercent: number,
  ) {}
}

/** Authenticated session — opaque sessionId plus its absolute expiration in ISO 8601. */
export class AuthSession {
  constructor(
    readonly sessionId: string,
    readonly expiresAt: string,
  ) {}
}

/** Request payload for `auth.configured`. */
export interface AuthConfiguredRequest extends Record<string, never> {}

/** Response payload of `auth.configured`. */
export type AuthConfiguredResponse = boolean;

/** Request payload for `auth.resources`. */
export interface AuthResourcesRequest extends Record<string, never> {}

/** Response payload of `auth.resources`. */
export type AuthResourcesResponse = AuthResources;

/** Request payload for `auth.configure`. */
export interface AuthConfigureRequest {
  /** Master password (minimum 8 characters). */
  readonly password: string;
}

/** Response payload of `auth.configure`. */
export type AuthConfigureResponse = AuthSession;

/** Request payload for `auth.authenticate`. */
export interface AuthAuthenticateRequest {
  /** Master password configured via auth.configure. */
  readonly password: string;
}

/** Response payload of `auth.authenticate`. */
export type AuthAuthenticateResponse = AuthSession;

/** Request payload for `auth.renew`. */
export interface AuthRenewRequest {
  /** Identifier of the session to refresh. */
  readonly sessionId: string;
}

/** Response payload of `auth.renew`. */
export type AuthRenewResponse = AuthSession;

/** Request payload for `auth.token.generate`. */
export interface AuthTokenGenerateRequest {
  /** Session minting the token; must be authenticated. */
  readonly sessionId: string;
  /** Scopes the token grants (see the MCP scope catalogue). */
  readonly scopes: ReadonlyArray<string>;
  /** Days until the token expires; null = never expires. */
  readonly ttlDays?: number | null;
}

/** Response payload of `auth.token.generate`. */
export type AuthTokenGenerateResponse = AuthTokenSummary;

/** Request payload for `auth.token.current`. */
export interface AuthTokenCurrentRequest {
  /** Authenticated session making the query. */
  readonly sessionId: string;
}

/** Response payload of `auth.token.current`. */
export type AuthTokenCurrentResponse = AuthTokenState;

/** Request payload for `auth.token.revoke`. */
export interface AuthTokenRevokeRequest {
  /** Authenticated session requesting revocation. */
  readonly sessionId: string;
}

/** Response payload of `auth.token.revoke`. */
export type AuthTokenRevokeResponse = AuthTokenRevoked;
