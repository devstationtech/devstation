import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { AccessToken } from "@server/auth/domain/models/access-token/access-token.ts";
import { Id } from "@server/auth/domain/models/id.ts";
import { Scope } from "@server/auth/domain/models/access-token/scope.ts";
import { WrappedKey } from "@server/auth/domain/models/access-token/wrapped-key.ts";
import type { TokenStore } from "@server/auth/domain/ports/outbound/token-store.ts";

/** `${DEVSTATION_HOME}/mcp/token.json` — the access token file. */
const FILENAME = "mcp/token.json";
const VERSION = 1;

/** On-disk shape of the token file. */
interface TokenFile {
  readonly version: number;
  readonly token: {
    readonly id: string;
    readonly purpose: string;
    readonly createdAt: string;
    readonly expiresAt: string | null;
    readonly scopes: readonly string[];
    readonly key: { readonly wrapped: string; readonly salt: string };
    /** Sibling of `key` — the wrapping secret is stored alongside the key in the token file. */
    readonly secret?: string;
  };
}

/**
 * File-system `TokenStore` — persists the single access token at
 * `${DEVSTATION_HOME}/mcp/token.json`. The `FileSystem` it receives is
 * rooted at the DevStation home, and `FileSystem.write` already
 * applies mode `0600` (and `0700` to the `mcp/` dir), so the token is
 * owner-only at rest.
 */
export class TokenStoreAdapter implements TokenStore {
  constructor(private readonly fs: FileSystem) {}

  save(token: AccessToken): Promise<void> {
    const file: TokenFile = {
      version: VERSION,
      token: {
        id: token.id.value,
        purpose: token.purpose,
        createdAt: token.createdAt.toString(),
        expiresAt: token.expiresAt ? token.expiresAt.toString() : null,
        scopes: token.scopes.map((s) => s.value),
        key: { wrapped: token.wrappedKey.wrapped, salt: token.wrappedKey.salt },
        secret: token.wrappedKey.secret,
      },
    };
    return this.fs.writeObjectOf(FILENAME, file);
  }

  async load(): Promise<AccessToken | null> {
    const file = await this.fs.readObjectOf<TokenFile>(FILENAME);
    if (!file) return null;
    const t = file.token;
    return new AccessToken(
      new Id(t.id),
      t.purpose,
      t.scopes.map((s) => new Scope(s)),
      new WrappedKey(t.key.wrapped, t.key.salt, t.secret),
      Instant.fromString(t.createdAt),
      t.expiresAt ? Instant.fromString(t.expiresAt) : null,
    );
  }

  async remove(): Promise<void> {
    if (!(await this.fs.exists(FILENAME))) return;
    await this.fs.delete(FILENAME);
  }
}
