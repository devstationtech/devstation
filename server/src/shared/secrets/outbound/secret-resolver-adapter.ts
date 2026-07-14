import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import type { SessionResolver } from "@server/shared/authentication/domain/ports/outbound/session-resolver.ts";
import type { RetrieveSecretHandler } from "@server/vault/application/handlers/retrieve-secret-handler.ts";
import { RetrieveSecret } from "@server/vault/application/commands/retrieve-secret.ts";
import type { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import type { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";

/**
 * In-process bridge that lets non-RPC consumers (cluster/provisioning,
 * station/install) decrypt secrets without a wire sessionId. Uses the
 * legacy `SessionResolver` (active session's key) to feed the vault
 * handler directly — bypasses the RPC layer entirely.
 */
export class SecretResolverAdapter implements SecretResolver {
  constructor(
    private readonly handler: RetrieveSecretHandler,
    private readonly session: SessionResolver,
  ) {}

  resolve(vault: Vault, secret: Secret): Promise<string | null> {
    return this.handler.handle(
      new RetrieveSecret(vault.value, secret.value, this.session.resolve()),
    );
  }
}
