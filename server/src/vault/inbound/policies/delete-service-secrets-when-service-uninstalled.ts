import type { Policy } from "@server/shared/building-blocks/domain/ports/events/outbound/policy.ts";
import type { ServiceUninstalled } from "@server/station/domain/events/service-uninstalled.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";
import { Id as VaultId } from "@server/vault/domain/models/id.ts";
import { DeleteSecret } from "@server/vault/application/commands/delete-secret.ts";
import type { DeleteSecretHandler } from "@server/vault/application/handlers/delete-secret-handler.ts";

/**
 * Inverse of `StoreServiceSecretsWhenServiceInstallSucceeded`: when a service is
 * torn down, deletes the secrets that install published for it. The store
 * policy keys them `<serviceId>-<role>-<name>`, so this drops every secret in
 * the service's vault whose name starts with `<serviceId>-`. Tolerant: a
 * missing vault (already removed) is a no-op.
 */
export class DeleteServiceSecretsWhenServiceUninstalled implements Policy<ServiceUninstalled> {
  constructor(
    private readonly vaults: Vaults,
    private readonly remove: DeleteSecretHandler,
  ) {}

  async on(event: ServiceUninstalled): Promise<void> {
    const vaultId = event.vault.value;
    const prefix = `${event.serviceId.value}-`;

    let secretIds: string[];
    try {
      const vault = await this.vaults.of(new VaultId(vaultId));
      secretIds = vault.secrets
        .filter((s) => s.name.value.startsWith(prefix))
        .map((s) => s.id.value);
    } catch {
      return; // vault gone — nothing to clean up
    }

    for (const id of secretIds) {
      await this.remove.handle(new DeleteSecret(vaultId, id));
    }
  }
}
