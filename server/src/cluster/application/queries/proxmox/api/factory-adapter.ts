import type { SecretResolver } from "@server/shared/secrets/domain/ports/outbound/secret-resolver.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import type { ProxmoxConnectionRecord } from "@server/cluster/application/queries/proxmox/records/connection-record.ts";
import type { ProxmoxReadApi } from "@server/cluster/application/queries/proxmox/api/proxmox-read-api.ts";
import type { ProxmoxReadApiFactory } from "@server/cluster/application/queries/proxmox/api/factory.ts";
import { ProxmoxApiAdapter } from "@server/cluster/application/queries/proxmox/api/adapter.ts";

export class ProxmoxReadApiAdapterFactory implements ProxmoxReadApiFactory {
  constructor(private readonly secretResolver: SecretResolver) {}

  async create(connection: ProxmoxConnectionRecord): Promise<ProxmoxReadApi | null> {
    const token = await this.secretResolver.resolve(
      new Vault(connection.vaultId),
      new Secret(connection.secretId),
    );
    if (!token) return null;
    return new ProxmoxApiAdapter({ host: connection.host, token });
  }
}
