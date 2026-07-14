import type { GenerateSecret } from "@server/vault/application/commands/generate-secret.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import type { Crypto } from "@server/vault/domain/ports/outbound/crypto.ts";
import { Id } from "@server/vault/domain/models/id.ts";
import { Name as SecretName } from "@server/vault/domain/models/secret/name.ts";
import { Value } from "@server/vault/domain/models/secret/value.ts";
import { Description } from "@server/vault/domain/models/secret/description.ts";
import { Key } from "@server/vault/domain/models/key.ts";
import { Secret } from "@server/vault/domain/models/secret/secret.ts";
import { Id as SecretId } from "@server/vault/domain/models/secret/id.ts";
import { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";

export class GenerateSecretHandler {
  constructor(
    private readonly vaults: Vaults,
    private readonly crypto: Crypto,
  ) {}

  /**
   * Returns the freshly-minted secret id so MCP inbound can echo it
   * back — without this, callers would need a second `vault_secrets_list`
   * + filter round-trip to recover the id. Consistent with the pattern
   * used by the register/create handlers.
   */
  async handle(command: GenerateSecret): Promise<{ secretId: string }> {
    const vault = await this.vaults.of(new Id(command.vaultId));
    const plain = command.value ? new Value(command.value) : Value.generate();
    const encrypted = await this.crypto.encrypt(plain, new Key(command.key));
    const id = new SecretId();
    const secret = new Secret(
      id,
      new SecretName(command.name),
      encrypted,
      command.description ? new Description(command.description) : null,
      Creation.now(new User(command.user), new Hostname(command.hostname)),
    );
    if (command.replaceIfExists) {
      vault.regenerate(secret);
    } else {
      vault.generate(secret);
    }
    await this.vaults.save(vault);
    return { secretId: id.value };
  }
}
