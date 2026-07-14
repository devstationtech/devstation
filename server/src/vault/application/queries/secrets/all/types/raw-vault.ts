import type { RawSecret } from "@server/vault/application/queries/secrets/all/types/raw-secret.ts";

export type RawVault = {
  id: string;
  secrets: RawSecret[];
};
