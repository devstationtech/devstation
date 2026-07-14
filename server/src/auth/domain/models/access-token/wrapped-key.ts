import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

/**
 * The vault key `K`, sealed for at-rest storage in an access token.
 *
 * `K` is wrapped (AES-256-GCM) under a key derived from a random
 * `secret`; `salt` seeds that derivation. The envelope shape — not the
 * raw key — is what's persisted, so a future hardened mode can drop
 * `secret` out of the token file (supplied externally) with no format
 * change.
 *
 * When `secret` is present (co-located in the token file), the file
 * alone can unwrap the key. When `secret` is absent, it must be
 * supplied externally by the caller.
 */
export class WrappedKey implements ValueObject {
  constructor(
    /** `iv:ciphertext`, both hex — the AES-GCM-wrapped key. */
    readonly wrapped: string,
    /** Hex salt for deriving the wrapping key from `secret`. */
    readonly salt: string,
    /** Hex wrapping secret. Present when co-located in the token file; absent when supplied externally. */
    readonly secret?: string,
  ) {
    if (!wrapped || !wrapped.includes(":")) {
      throw new Error("wrapped key must be 'iv:ciphertext' hex.");
    }
    if (!salt) throw new Error("wrapped key salt is required.");
  }
}
