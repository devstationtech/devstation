import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Name as NodeName } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Node as ProxmoxNode } from "@server/cluster/domain/models/proxmox/nodes/node.ts";

export class RegisterNode implements Command {
  constructor(
    readonly clusterId: string,
    readonly name: string,
    readonly ip: string,
    readonly vaultId: string,
    readonly usernameSecretId: string,
    readonly passwordSecretId: string,
  ) {}

  toNode(): ProxmoxNode {
    return new ProxmoxNode(
      new NodeId(),
      new NodeName(this.name),
      new Ip(this.ip),
      new Credential(
        new Vault(this.vaultId),
        new Secret(this.usernameSecretId),
        new Secret(this.passwordSecretId),
      ),
    );
  }
}
