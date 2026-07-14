import { argon2id } from "hash-wasm";
import type { Auth } from "@server/auth/domain/ports/outbound/auth.ts";
import { Key } from "@server/auth/domain/models/key.ts";
import type { Password } from "@server/auth/domain/models/password.ts";
import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";

const SALT_FILE = ".salt";
const AUTH_FILE = ".auth";
const SENTINEL = "devstation-auth-v1";

// Argon2id parameters matching libsodium MODERATE presets
const ARGON2_ITERATIONS = 3;
const ARGON2_MEMORY_KB = 262144; // 256 MB
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;

export class Argon2Adapter implements Auth {
  constructor(private readonly fs: FileSystem) {}

  isConfigured(): Promise<boolean> {
    return this.fs.exists(SALT_FILE);
  }

  async configure(password: Password): Promise<Key> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await this.deriveKey(password.value, salt);

    const sentinel = await this.encryptSentinel(key);
    await this.fs.write(SALT_FILE, toHex(salt));
    await this.fs.write(AUTH_FILE, sentinel);

    return new Key(key);
  }

  async authenticate(password: Password): Promise<Key | null> {
    const saltHex = (await this.fs.read(SALT_FILE)).trim();
    const salt = fromHex(saltHex);
    const key = await this.deriveKey(password.value, salt);

    const sentinelRaw = (await this.fs.read(AUTH_FILE)).trim();
    const ok = await this.verifySentinel(key, sentinelRaw);
    if (!ok) return null;

    return new Key(key);
  }

  private deriveKey(password: string, salt: Uint8Array): Promise<string> {
    return argon2id({
      password,
      salt,
      iterations: ARGON2_ITERATIONS,
      memorySize: ARGON2_MEMORY_KB,
      parallelism: ARGON2_PARALLELISM,
      hashLength: ARGON2_HASH_LENGTH,
      outputType: "hex",
    });
  }

  private async encryptSentinel(keyHex: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      fromHex(keyHex),
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(SENTINEL),
    );
    return `${toHex(iv)}:${toHex(new Uint8Array(ciphertext))}`;
  }

  private async verifySentinel(keyHex: string, stored: string): Promise<boolean> {
    try {
      const [ivHex, ciphertextHex] = stored.split(":");
      const key = await crypto.subtle.importKey(
        "raw",
        fromHex(keyHex),
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromHex(ivHex) },
        key,
        fromHex(ciphertextHex),
      );
      return new TextDecoder().decode(plaintext) === SENTINEL;
    } catch {
      return false;
    }
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}
