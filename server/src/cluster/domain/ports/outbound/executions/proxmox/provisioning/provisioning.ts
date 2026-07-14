import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { ProxmoxCluster } from "@server/cluster/domain/models/proxmox/proxmox-cluster.ts";
import type { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";

/**
 * Outbound port for Provisioning operations on a Proxmox cluster.
 *
 * Each method is a factory: it binds the cluster and nodes to a Task
 * without running anything yet. The handler hands the Task to the
 * Executions runtime, which then calls `run` and consumes the stream.
 *
 * The adapter that implements this port yields generic Log/Step events
 * while the underlying provisioning runtime runs — including a final Log line
 * with the per-node create/update/delete summary. Per-node lifecycle
 * (planning started/completed/failed) is signalled separately as cluster
 * domain events via the dispatcher, not through this stream.
 */
export interface Provisioning {
  /** Build a Task that runs the provisioning plan for the given nodes. */
  plan(cluster: ProxmoxCluster, nodeIds: NodeId[]): Task;

  /** Build a Task that runs the provisioning apply for the given nodes. */
  apply(cluster: ProxmoxCluster, nodeIds: NodeId[]): Task;

  /** Build a Task that runs the provisioning destroy for the given nodes. */
  destroy(cluster: ProxmoxCluster, nodeIds: NodeId[]): Task;
}
