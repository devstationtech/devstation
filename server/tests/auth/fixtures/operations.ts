import { Key } from "@server/auth/domain/models/key.ts";

export function authKey(key = "test-key"): Key {
  return new Key(key);
}
