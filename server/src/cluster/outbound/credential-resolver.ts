import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

export type ResolvedCredential = {
  user: string;
  password: string;
};

export class CredentialResolver {
  constructor(private readonly secretResolver: SecretResolver) {}

  async resolve(
    vaultId: string,
    usernameSecretId: string,
    passwordSecretId: string,
  ): Promise<ResolvedCredential> {
    const vault = new Vault(vaultId);
    const user = await this.secretResolver.resolve(vault, new Secret(usernameSecretId));
    const password = await this.secretResolver.resolve(vault, new Secret(passwordSecretId));
    if (!user) {
      throw new Error(`username secret '${usernameSecretId}' not found in vault '${vaultId}'.`);
    }
    if (!password) {
      throw new Error(`password secret '${passwordSecretId}' not found in vault '${vaultId}'.`);
    }
    return { user, password };
  }
}
