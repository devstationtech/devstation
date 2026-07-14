import { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import { Value } from "@server/vault/domain/models/secret/value.ts";
import type { Key } from "@server/vault/domain/models/key.ts";
import type { Crypto } from "@server/vault/domain/ports/outbound/crypto.ts";

export class CryptoAdapter implements Crypto {
  async decrypt(encrypted: Encrypted, key: Key): Promise<Value> {
    const [ivHex, ciphertextHex] = encrypted.value.split(":");
    const cryptoKey = await this.importKey(key.value);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: this.hexToBytes(ivHex) },
      cryptoKey,
      this.hexToBytes(ciphertextHex),
    );
    return new Value(new TextDecoder().decode(plaintext));
  }

  async encrypt(value: Value, key: Key): Promise<Encrypted> {
    const cryptoKey = await this.importKey(key.value);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      new TextEncoder().encode(value.value),
    );
    return new Encrypted(`${this.bytesToHex(iv)}:${this.bytesToHex(new Uint8Array(ciphertext))}`);
  }

  private importKey(key: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
      "raw",
      this.hexToBytes(key),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }

  private hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
}
