import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { Storage } from "@server/cluster/domain/models/proxmox/nodes/storage.ts";
import { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { UpdateAssignedImage } from "@server/cluster/application/commands/proxmox/update-assigned-image.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";

export class UpdateAssignedImageHandler {
  constructor(private readonly clusters: Clusters) {}

  async handle(command: UpdateAssignedImage): Promise<void> {
    await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        const imageId = new ImageId(command.imageId);
        // Editing only the template VMID / storage — keep the existing snapshot.
        const image = cluster.nodeImageOf(new NodeId(command.nodeId), imageId);
        const nodeImage = new NodeImage(
          imageId,
          image.name,
          image.os,
          image.source,
          new VirtualMachineId(command.virtualMachineId),
          new Storage(command.storage),
        );
        cluster.replaceAssignedImage(new NodeId(command.nodeId), imageId, nodeImage);
      },
    );
  }
}
