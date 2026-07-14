import type { State } from "@server/cluster/domain/models/proxmox/nodes/state.ts";

/**
 * Raised by `acknowledgeInterruption` when the node is not actually in a
 * transient state. Prevents the operator from marking a healthy node as
 * failed by mistake.
 */
export class NodeNotInterrupted extends Error {
  constructor(state: State) {
    super(
      `cannot acknowledge interruption: node is in state ${state}, not in a transient ` +
        `state (PLAN_STARTED / APPLY_STARTED / DESTROY_STARTED).`,
    );
  }
}
