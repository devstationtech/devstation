import type { Task } from "@server/shared/executions/domain/models/task.ts";
import type { Node } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import type { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";

/**
 * Outbound port for Proxmox image operations.
 *
 * `create` is a factory: it binds the node, the logical image
 * size and the per-node assignment (virtualMachineId + storage) to a Task
 * without running anything yet. The handler hands the Task to the
 * Executions runtime, which then calls `run` and consumes the stream.
 *
 * The adapter materializes the image on the target Proxmox node via
 * SSH, yielding Log and Step outputs as it progresses.
 */
export interface Images {
  /** Build a Task that creates the image on the given node. */
  create(node: Node, assigned: NodeImage): Task;
}
