import type { ProxmoxCredentialRecord } from "@server/cluster/application/queries/proxmox/records/credential-record.ts";
import type { ProxmoxResources } from "@server/cluster/application/queries/proxmox/records/resources.ts";

export type ProxmoxNodeRecord = {
  id: string;
  name: string;
  ip: string;
  credential: ProxmoxCredentialRecord;
  virtualMachineCount: number;
  resources: ProxmoxResources;
  /** Node FSM lifecycle state — the UI gates VM mutations while in-flight. */
  state: string;
  /**
   * True when `state ∈ {PLAN_STARTED, APPLY_STARTED, DESTROY_STARTED}`
   * — the node sits in a transient state, which (since `InMemoryExecutions`
   * has no cross-process persistence) implies the last long-running op
   * was interrupted (process crash/restart). The UI surfaces this so the
   * operator can `cluster.proxmox.nodes.acknowledgeInterruption` to unwedge.
   * See the node FSM recovery design for details.
   */
  interrupted: boolean;
};
