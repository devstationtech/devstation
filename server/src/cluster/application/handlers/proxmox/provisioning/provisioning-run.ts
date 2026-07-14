import { Id } from "@server/cluster/domain/models/id.ts";
import { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Clusters } from "@server/cluster/domain/ports/outbound/clusters.ts";
import type { Provisioning } from "@server/cluster/domain/ports/outbound/executions/proxmox/provisioning/provisioning.ts";
import type { Executions } from "@server/shared/executions/domain/ports/outbound/executions.ts";
import type { Execution } from "@server/shared/executions/domain/models/execution.ts";
import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { Dispatcher } from "@server/shared/building-blocks/domain/ports/events/outbound/dispatcher.ts";

/**
 * The verb triple that distinguishes plan from apply from destroy: which FSM
 * transitions to drive on the aggregate and which provisioning Task to run.
 * Everything else — per-node loop, persist-then-dispatch discipline, failure
 * transition and the stuck-state rescue — is identical across the three and
 * lives once in `ProvisioningRun`.
 */
export type ProvisioningPhase = {
  start(cluster: ProxmoxCluster, node: NodeId): void;
  complete(cluster: ProxmoxCluster, node: NodeId): void;
  fail(cluster: ProxmoxCluster, node: NodeId): void;
  task(provisioning: Provisioning, snapshot: ProxmoxCluster, node: NodeId): Task;
};

/**
 * Shared orchestration for the three provisioning phases. Factoring
 * the loop here guarantees every phase carries the same failure
 * discipline — earlier triplicated handlers had diverged, leaving
 * apply/destroy without the stuck-state recovery that plan had.
 */
export class ProvisioningRun {
  constructor(
    private readonly clusters: Clusters,
    private readonly executions: Executions,
    private readonly provisioning: Provisioning,
    private readonly dispatcher: Dispatcher,
  ) {}

  async start(
    clusterId: string,
    requestedNodeIds: string[],
    phase: ProvisioningPhase,
  ): Promise<Execution> {
    const id = new Id(clusterId);
    // Snapshot only for nodeId resolution + provisioning config; every
    // state mutation goes through `clusters.update` (reloaded fresh
    // under the lock).
    const snapshot = await this.clusters.of<ProxmoxCluster>(id);
    const nodeIds = this.resolveNodeIds(snapshot, requestedNodeIds);
    const { clusters, provisioning, dispatcher } = this;

    const task: Task = {
      run: async (execution, emitter) => {
        for (const nodeId of nodeIds) {
          let reachedTerminal = false;
          const started = await clusters.update<ProxmoxCluster>(
            id,
            (c) => phase.start(c, nodeId),
          );
          // Event dispatch lives INSIDE the try block below. Before, it was
          // outside try/finally, so any throw during dispatch left the node
          // permanently stuck in the *_STARTED state with no in-band recovery.
          try {
            await dispatcher.dispatch(started.events.pull());
            try {
              await phase.task(provisioning, snapshot, nodeId).run(execution, emitter);
            } catch (error) {
              const failed = await clusters.update<ProxmoxCluster>(
                id,
                (c) => phase.fail(c, nodeId),
              );
              await dispatcher.dispatch(failed.events.pull());
              reachedTerminal = true;
              throw error;
            }

            const done = await clusters.update<ProxmoxCluster>(
              id,
              (c) => phase.complete(c, nodeId),
            );
            await dispatcher.dispatch(done.events.pull());
            reachedTerminal = true;
          } finally {
            // Belt-and-suspenders: if nothing in the try block managed to
            // land a terminal transition, force a *_STARTED → *_FAILED
            // best-effort so the next attempt isn't blocked by
            // `invalid node state transition: *_STARTED → *_STARTED`.
            // Any error here is swallowed — leaving a node stuck is
            // strictly worse than a noisy log.
            if (!reachedTerminal) {
              try {
                const rescued = await clusters.update<ProxmoxCluster>(
                  id,
                  (c) => phase.fail(c, nodeId),
                );
                try {
                  await dispatcher.dispatch(rescued.events.pull());
                } catch {
                  /* swallow — recovery is best-effort */
                }
              } catch {
                /* node may already have transitioned elsewhere — accept it */
              }
            }
          }
        }
      },
    };

    return this.executions.start(task);
  }

  private resolveNodeIds(cluster: ProxmoxCluster, requested: string[]): NodeId[] {
    if (requested.length > 0) return requested.map((id) => new NodeId(id));
    return cluster.nodes.items.map((n) => n.id);
  }
}
