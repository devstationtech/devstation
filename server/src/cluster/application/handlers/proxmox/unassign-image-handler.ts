import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { UnassignImage } from "@server/cluster/application/commands/proxmox/unassign-image.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";

/** Dispatcher is optional so lean integration tests skip the event chain. */
const NOOP_DISPATCHER: Dispatcher = {
  dispatch: (_events: readonly DomainEvent[]) => Promise.resolve(),
};

export class UnassignImageHandler {
  constructor(
    private readonly clusters: Clusters,
    private readonly dispatcher: Dispatcher = NOOP_DISPATCHER,
  ) {}

  async handle(command: UnassignImage): Promise<void> {
    const updated = await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => {
        cluster.unassignImage(new NodeId(command.nodeId), new ImageId(command.imageId));
      },
    );
    await this.dispatcher.dispatch(updated.events.pull());
  }
}
