import type { Password } from "@server/auth/domain/models/password.ts";
import type { Key } from "@server/auth/domain/models/key.ts";

export interface Auth {
  isConfigured(): Promise<boolean>;
  configure(password: Password): Promise<Key>;
  authenticate(password: Password): Promise<Key | null>;
}
