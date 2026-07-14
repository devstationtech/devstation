import type { Key } from "@server/auth/domain/models/key.ts";
import type { WrappedKey } from "@server/auth/domain/models/access-token/wrapped-key.ts";

/**
 * Seals / unseals the vault key for at-rest storage in an access
 * token. `wrap` produces a fresh envelope (random secret + salt);
 * `unwrap` reverses it. The wrapping is independent of the master
 * password — the password is never an input or an output here.
 */
export interface KeyWrap {
  wrap(key: Key): Promise<WrappedKey>;
  unwrap(wrapped: WrappedKey): Promise<Key>;
}
