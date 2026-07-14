import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import { Name as ImageName } from "@server/cluster/domain/models/proxmox/images/name.ts";
import { Source } from "@server/cluster/domain/models/proxmox/images/source.ts";
import { Url } from "@server/cluster/domain/models/proxmox/images/url.ts";
import type { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { Storage } from "@server/cluster/domain/models/proxmox/nodes/storage.ts";
import { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { AssignImage } from "@server/cluster/application/commands/proxmox/assign-image.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";

/** Dispatcher is optional so lean integration tests skip the event chain. */
const NOOP_DISPATCHER: Dispatcher = {
  dispatch: (_events: readonly DomainEvent[]) => Promise.resolve(),
};

export class AssignImageHandler {
  constructor(
    private readonly clusters: Clusters,
    private readonly dispatcher: Dispatcher = NOOP_DISPATCHER,
  ) {}

  async handle(command: AssignImage): Promise<void> {
    const updated = await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        // Snapshot the catalog image (sent by the UI that listed the central
        // catalog) onto the node — the assignment is independent of the catalog.
        const nodeImage = new NodeImage(
          new ImageId(command.imageId),
          new ImageName(command.name),
          command.os as OperatingSystem,
          new Source(new Url(command.sourceUrl)),
          new VirtualMachineId(command.virtualMachineId),
          new Storage(command.storage),
        );
        cluster.assignImage(new NodeId(command.nodeId), nodeImage);
      },
    );
    await this.dispatcher.dispatch(updated.events.pull());
  }
}
