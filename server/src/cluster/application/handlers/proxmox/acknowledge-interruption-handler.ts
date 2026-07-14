import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { AcknowledgeInterruption } from "@server/cluster/application/commands/proxmox/acknowledge-interruption.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";

/**
 * Delegates to the aggregate's `acknowledgeInterruption(nodeId)`, which
 * dispatches to the right `fail*()` based on the current state and emits
 * the matching `Node*Failed` event for listeners (UI/store/audit). Throws
 * `NodeNotInterrupted` (domain) when the node isn't in a transient
 * state — surfaces as a clear RPC error.
 *
 * Dispatcher is optional so plain integration tests (no UI listeners)
 * stay lean — they can validate state-machine demotion + persistence
 * without standing up the dispatcher chain.
 */
const NOOP_DISPATCHER: Dispatcher = {
  dispatch: (_events: readonly DomainEvent[]) => Promise.resolve(),
};

export class AcknowledgeInterruptionHandler {
  constructor(
    private readonly clusters: Clusters,
    private readonly dispatcher: Dispatcher = NOOP_DISPATCHER,
  ) {}

  async handle(command: AcknowledgeInterruption): Promise<void> {
    const ack = await this.clusters.update<ProxmoxCluster>(
      new Id(command.clusterId),
      (cluster) => cluster.acknowledgeInterruption(new NodeId(command.nodeId)),
    );
    await this.dispatcher.dispatch(ack.events.pull());
  }
}
