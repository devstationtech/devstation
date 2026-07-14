import { Key } from "@server/auth/domain/models/key.ts";
import { WrappedKey } from "@server/auth/domain/models/access-token/wrapped-key.ts";
import type { KeyWrap } from "@server/auth/domain/ports/outbound/key-wrap.ts";

const HKDF_INFO = new TextEncoder().encode("devstation-mcp-token-v1");

/**
 * Seals the vault key with a fresh random secret: `tokenKey =
 * HKDF-SHA256(secret, salt)`, then `AES-256-GCM(key, tokenKey)`.
 *
 * HKDF (not Argon2) on purpose — `secret` is 32 random bytes, already
 * full-entropy, so no password-stretching is needed. The master
 * password is never an input here; the produced envelope cannot be
 * reversed to it.
 */
export class KeyWrapAdapter implements KeyWrap {
  async wrap(key: Key): Promise<WrappedKey> {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const tokenKey = await this.deriveKey(secret, salt);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      tokenKey,
      new TextEncoder().encode(key.value),
    );

    return new WrappedKey(
      `${toHex(iv)}:${toHex(new Uint8Array(ciphertext))}`,
      toHex(salt),
      toHex(secret),
    );
  }

  async unwrap(wrapped: WrappedKey): Promise<Key> {
    if (!wrapped.secret) {
      throw new Error(
        "wrapped key carries no secret — cannot unwrap (externally-supplied " +
          "secrets are a future hardened mode, not supported yet).",
      );
    }
    const tokenKey = await this.deriveKey(fromHex(wrapped.secret), fromHex(wrapped.salt));
    const [ivHex, ciphertextHex] = wrapped.wrapped.split(":");
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromHex(ivHex) },
      tokenKey,
      fromHex(ciphertextHex),
    );
    return new Key(new TextDecoder().decode(plaintext));
  }

  private async deriveKey(
    secret: Uint8Array<ArrayBuffer>,
    salt: Uint8Array<ArrayBuffer>,
  ): Promise<CryptoKey> {
    const ikm = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: HKDF_INFO },
      ikm,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}
