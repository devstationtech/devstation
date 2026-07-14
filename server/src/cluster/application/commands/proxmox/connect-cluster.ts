import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";
import { Connection as ProxmoxConnection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { ProvisioningPolicy } from "@server/cluster/domain/models/proxmox/connection/provisioning-policy.ts";

export class ConnectCluster implements Command {
  constructor(
    readonly clusterId: string,
    readonly host: string,
    readonly vaultId: string,
    readonly secretId: string,
    // Optional provisioning override; absent → auto-detect clone, serial apply.
    readonly cloneStrategy?: string,
    readonly parallelism?: number,
  ) {}

  toProxmoxConnection(): ProxmoxConnection {
    return new ProxmoxConnection(
      new Hostname(this.host),
      new Vault(this.vaultId),
      new Secret(this.secretId),
      ProvisioningPolicy.from(this.cloneStrategy, this.parallelism),
    );
  }
}
