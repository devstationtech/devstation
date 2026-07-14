import { State } from "@server/cluster/domain/models/proxmox/nodes/state.ts";

/**
 * Raised when a node FSM transition is invalid. The state machine requires
 * a fresh `plan` between a destroy and the next apply (apply consumes a
 * plan file). The exception appends a remediation hint when the required
 * next step is unambiguous, so users and LLM agents can self-correct.
 */
export class InvalidNodeStateTransition extends Error {
  constructor(from: State, to: State) {
    super(`invalid node state transition: ${from} → ${to}.${hintFor(from, to)}`);
  }
}

function hintFor(from: State, to: State): string {
  // Build a tiny table of {from → required intermediate step} for the
  // transitions we expect users/agents to attempt most often.
  if (to === State.APPLY_STARTED) {
    if (from === State.DESTROY_SUCCEEDED) {
      return " Run `devstation_cluster_provisioning_plan` first — apply requires a fresh plan after destroy.";
    }
    if (from === State.REGISTERED) {
      return " Run `devstation_cluster_provisioning_plan` first — apply needs a plan to consume.";
    }
    if (from === State.APPLY_SUCCEEDED) {
      return " The node is already provisioned. Run `devstation_cluster_provisioning_destroy` first, or `devstation_cluster_provisioning_plan` to apply changes.";
    }
  }
  if (to === State.DESTROY_STARTED && from === State.REGISTERED) {
    return " Nothing to destroy — the node has never been provisioned.";
  }
  if (to === State.PLAN_STARTED && from === State.PLAN_STARTED) {
    return " A previous plan is in-flight or got stuck. Run `devstation_cluster_node_acknowledge_interruption` to reset it.";
  }
  return "";
}
