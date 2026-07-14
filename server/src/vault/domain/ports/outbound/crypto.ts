import type { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import type { Value } from "@server/vault/domain/models/secret/value.ts";
import type { Key } from "@server/vault/domain/models/key.ts";

export interface Crypto {
  encrypt(value: Value, key: Key): Promise<Encrypted>;
  decrypt(encrypted: Encrypted, key: Key): Promise<Value>;
}
