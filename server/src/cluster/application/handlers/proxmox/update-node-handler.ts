import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Name as NodeName } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Node as ProxmoxNode } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { NodeNotFound } from "@server/cluster/domain/exceptions/node-not-found.ts";
import type { UpdateNode } from "@server/cluster/application/commands/proxmox/update-node.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class UpdateNodeHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: UpdateNode): Promise<void> {
    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        const nodeId = new NodeId(command.nodeId);
        const existing = cluster.nodes.items.find((n) => n.id.value === nodeId.value);
        if (!existing) throw new NodeNotFound();
        const proxmoxNode = existing as ProxmoxNode;
        const replacement = new ProxmoxNode(
          proxmoxNode.id,
          new NodeName(command.name),
          new Ip(command.ip),
          new Credential(
            new Vault(command.vaultId),
            new Secret(command.usernameSecretId),
            new Secret(command.passwordSecretId),
          ),
          proxmoxNode.images,
          proxmoxNode.virtualMachines,
        );
        cluster.replaceNode(nodeId, replacement);
      },
    );
  }
}
