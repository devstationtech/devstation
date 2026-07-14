// AUTO-GENERATED from @jsonrpc-schemas/vault.openrpc.json
// Do not edit by hand — run `deno task contracts:codegen`.

export type Ack = Record<string, unknown>;

/** Vault summary for listing. */
export class VaultRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly version: number,
  ) {}
}

/** Secret metadata (no value). */
export class SecretRecord {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly description: string | null,
    readonly createdAt: string,
    readonly createdBy: string,
  ) {}
}

/** Decrypted secret value. `value` is null when the secret/vault was not found. */
export class SecretValue {
  constructor(
    readonly value: string | null,
  ) {}
}

/** Request payload for `vault.create`. */
export interface VaultCreateRequest {
  /** Authenticated session id. */
  readonly sessionId: string;
  readonly name: string;
  /** Logged-in user creating the vault. */
  readonly user: string;
  /** Host where the vault was created. */
  readonly hostname: string;
}

/** Response payload of `vault.create`. */
export type VaultCreateResponse = Ack;

/** Request payload for `vault.delete`. */
export interface VaultDeleteRequest {
  readonly sessionId: string;
  readonly vaultId: string;
}

/** Response payload of `vault.delete`. */
export type VaultDeleteResponse = Ack;

/** Request payload for `vault.list`. */
export interface VaultListRequest {
  readonly sessionId: string;
}

/** Response payload of `vault.list`. */
export type VaultListResponse = ReadonlyArray<VaultRecord>;

/** Request payload for `vault.secrets.generate`. */
export interface VaultSecretsGenerateRequest {
  readonly sessionId: string;
  readonly vaultId: string;
  readonly name: string;
  readonly user: string;
  readonly hostname: string;
  /** Plaintext value. If absent, the server generates a random secret. */
  readonly value?: string | null;
  readonly description?: string | null;
}

/** Response payload of `vault.secrets.generate`. */
export type VaultSecretsGenerateResponse = Ack;

/** Request payload for `vault.secrets.retrieve`. */
export interface VaultSecretsRetrieveRequest {
  readonly sessionId: string;
  readonly vaultId: string;
  readonly secretId: string;
}

/** Response payload of `vault.secrets.retrieve`. */
export type VaultSecretsRetrieveResponse = SecretValue;

/** Request payload for `vault.secrets.delete`. */
export interface VaultSecretsDeleteRequest {
  readonly sessionId: string;
  readonly vaultId: string;
  readonly secretId: string;
}

/** Response payload of `vault.secrets.delete`. */
export type VaultSecretsDeleteResponse = Ack;

/** Request payload for `vault.rename`. */
export interface VaultRenameRequest {
  readonly sessionId: string;
  readonly vaultId: string;
  readonly name: string;
}

/** Response payload of `vault.rename`. */
export type VaultRenameResponse = Ack;

/** Request payload for `vault.secrets.rename`. */
export interface VaultSecretsRenameRequest {
  readonly sessionId: string;
  readonly vaultId: string;
  readonly secretId: string;
  readonly name: string;
}

/** Response payload of `vault.secrets.rename`. */
export type VaultSecretsRenameResponse = Ack;

/** Request payload for `vault.secrets.list`. */
export interface VaultSecretsListRequest {
  readonly sessionId: string;
  readonly vaultId: string;
}

/** Response payload of `vault.secrets.list`. */
export type VaultSecretsListResponse = ReadonlyArray<SecretRecord>;
