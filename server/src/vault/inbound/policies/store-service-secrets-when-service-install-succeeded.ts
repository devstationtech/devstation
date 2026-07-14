import { hostname } from "node:os";
import type { Policy } from "@server/shared/building-blocks/domain/ports/events/outbound/policy.ts";
import type { SessionResolver } from "@server/shared/authentication/domain/ports/outbound/session-resolver.ts";
import { GenerateSecret } from "@server/vault/application/commands/generate-secret.ts";
import type { GenerateSecretHandler } from "@server/vault/application/handlers/generate-secret-handler.ts";
import type { ServiceInstallSucceeded } from "@server/station/domain/events/service-install-succeeded.ts";

/**
 * Persists each `published.secrets[name]` carried by a `ServiceInstallSucceeded` event
 * under `<service.name>-<role.name>-<name>` in the vault referenced by the event.
 *
 * The service NAME (not its id) keys the secret: a station vault holds one
 * service per name, so `jenkins-main-admin-password` is both unique and
 * human-readable, instead of the opaque `<uuid>-main-admin-password`.
 *
 * Iterates every installation in the payload — single services have a single
 * entry, clustered services have N. The plaintext map travels in-memory only;
 * it is encrypted on write and dropped after the call returns.
 *
 * Re-installs overwrite existing secrets via the same key — vault is not
 * a install-history store; only the latest result lives there.
 */
export class StoreServiceSecretsWhenServiceInstallSucceeded
  implements Policy<ServiceInstallSucceeded> {
  constructor(
    private readonly generate: GenerateSecretHandler,
    private readonly session: SessionResolver,
  ) {}

  async on(event: ServiceInstallSucceeded): Promise<void> {
    const key = this.session.resolve();
    const host = hostname();
    const serviceName = this.slugify(event.name.value);
    for (const installation of event.installations) {
      const roleName = installation.role.name;
      for (const [secretName, value] of Object.entries(installation.result.secrets)) {
        const command = new GenerateSecret(
          event.vault.value,
          this.secretName(serviceName, roleName, secretName),
          key,
          host,
          "service",
          value,
          `published by service ${event.name.value} role ${roleName}`,
          /* replaceIfExists */ true,
        );
        await this.generate.handle(command);
      }
    }
  }

  /**
   * Vault key for a published secret: `<service>-<role>-<secret>`. The service
   * NAME (unique within a station's vault) keys it — human-readable, unlike the
   * old serviceId-UUID prefix. Role.name disambiguates multi-role/clustered
   * services; the local secret name is slugified so the key is a valid slug
   * regardless of casing/punctuation in the author's choice (`k3sToken`,
   * `API_KEY`, `db.password`, …).
   */
  private secretName(serviceName: string, roleName: string, secretName: string): string {
    return `${serviceName}-${roleName}-${this.slugify(secretName)}`;
  }

  private slugify(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .toLowerCase()
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
