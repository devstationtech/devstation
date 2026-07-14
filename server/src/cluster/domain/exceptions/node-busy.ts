import type { Name } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import type { State } from "@server/cluster/domain/models/proxmox/nodes/state.ts";

/**
 * Raised when a virtual-machine mutation is attempted on a node that is
 * mid-lifecycle (provisioning / destroying). The in-flight state is a
 * domain lock: provisioning is creating or tearing down exactly these VMs
 * from their current spec, so editing/adding/removing a VM now would
 * race the run and corrupt the end state. Node-level changes and
 * compose-then-replan (PLAN states) stay allowed on purpose.
 */
export class NodeBusy extends Error {
  constructor(nodeName: Name, state: State) {
    super(
      `node '${nodeName.value}' is ${state} — its virtual machines cannot be changed until it finishes.`,
    );
  }
}
