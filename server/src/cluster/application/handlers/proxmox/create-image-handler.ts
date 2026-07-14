import { Id } from "@server/cluster/domain/models/id.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import { NodeCredentialMissing } from "@server/cluster/domain/exceptions/node-credential-missing.ts";
import type { CreateImage as CreateImageCommand } from "@server/cluster/application/commands/proxmox/create-image.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Images } from "@server/cluster/domain/ports/outbound/executions/proxmox/images/images.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";

export class CreateImageHandler {
  constructor(
    private readonly clusters: Clusters,
    private readonly executions: Executions,
    private readonly images: Images,
  ) {}

  async handle(command: CreateImageCommand): Promise<Execution> {
    const cluster = await this.clusters.of<ProxmoxCluster>(new Id(command.clusterId));
    const node = cluster.nodes.of(new NodeId(command.nodeId));
    const imageId = new ImageId(command.imageId);
    const assigned = node.images.of(imageId);

    const c = node.credential;
    if (!c.isConfigured()) {
      throw new NodeCredentialMissing(node.name.value);
    }

    const task = this.images.create(node, assigned);
    return this.executions.start(task);
  }
}
