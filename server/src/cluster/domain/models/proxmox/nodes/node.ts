import type { VirtualMachine } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machine.ts";
import type { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { VirtualMachines } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machines.ts";
import type { Id } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { Name } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import type { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import type { Credential } from "@server/shared/building-blocks/domain/models/value-objects/credential.ts";
import { NodeImages } from "@server/cluster/domain/models/proxmox/nodes/images/node-images.ts";
import type { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";
import type { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import { State } from "@server/cluster/domain/models/proxmox/nodes/state.ts";
import { InvalidNodeStateTransition } from "@server/cluster/domain/exceptions/invalid-node-state-transition.ts";
import { NodeBusy } from "@server/cluster/domain/exceptions/node-busy.ts";

// States during which provisioning is actively creating/tearing down this
// node's VMs from their current spec — VM mutations are locked. PLAN
// states are intentionally excluded so compose-then-replan stays free.
const VM_LOCKED_STATES: readonly State[] = [State.APPLY_STARTED, State.DESTROY_STARTED];

// Three additive edges keep teardown always reachable so real infra is
// never stranded:
// G1: a plan on live infra lands in PLAN_SUCCEEDED — destroy must still be
//     reachable (destroy is idempotent: no-op on a never-provisioned node,
//     tears down a re-planned one).
// G2: a failed apply often leaves partial VMs — DESTROY_STARTED lets the
//     operator clean them up instead of only retry/replan (orphans).
// G3: a stuck destroy can re-plan to reconcile with reality instead of
//     only blind destroy-retry.
const ALLOWED: Readonly<Record<State, readonly State[]>> = {
  [State.REGISTERED]: [State.PLAN_STARTED],
  [State.PLAN_STARTED]: [State.PLAN_SUCCEEDED, State.PLAN_FAILED],
  [State.PLAN_SUCCEEDED]: [State.APPLY_STARTED, State.PLAN_STARTED, State.DESTROY_STARTED],
  [State.PLAN_FAILED]: [State.PLAN_STARTED],
  [State.APPLY_STARTED]: [State.APPLY_SUCCEEDED, State.APPLY_FAILED],
  [State.APPLY_SUCCEEDED]: [State.DESTROY_STARTED, State.PLAN_STARTED],
  [State.APPLY_FAILED]: [
    State.APPLY_STARTED,
    State.PLAN_STARTED,
    State.DESTROY_STARTED,
  ],
  [State.DESTROY_STARTED]: [State.DESTROY_SUCCEEDED, State.DESTROY_FAILED],
  [State.DESTROY_SUCCEEDED]: [State.PLAN_STARTED],
  [State.DESTROY_FAILED]: [State.DESTROY_STARTED, State.PLAN_STARTED],
};

export class Node {
  constructor(
    readonly id: Id,
    readonly name: Name,
    readonly ip: Ip,
    readonly credential: Credential,
    readonly images: NodeImages = new NodeImages(),
    readonly virtualMachines: VirtualMachines = new VirtualMachines(),
    readonly state: State = State.REGISTERED,
  ) {}

  /** True while provisioning is creating/tearing down this node's VMs. */
  get busy(): boolean {
    return VM_LOCKED_STATES.includes(this.state);
  }

  /** Domain lock: VM mutations are invalid while the node is in-flight. */
  ensureVirtualMachinesMutable(): void {
    if (this.busy) throw new NodeBusy(this.name, this.state);
  }

  register(vm: VirtualMachine): Node {
    return this.withChanges({ virtualMachines: this.virtualMachines.register(vm) });
  }

  unregister(id: VirtualMachineId): Node {
    return this.withChanges({ virtualMachines: this.virtualMachines.unregister(id) });
  }

  unregisterAll(): Node {
    return this.withChanges({ virtualMachines: this.virtualMachines.clear() });
  }

  assignImage(nodeImage: NodeImage): Node {
    return this.withChanges({ images: this.images.assign(nodeImage) });
  }

  unassignImage(imageId: ImageId): Node {
    return this.withChanges({ images: this.images.unassign(imageId) });
  }

  replaceAssignedImage(imageId: ImageId, nodeImage: NodeImage): Node {
    return this.withChanges({ images: this.images.replace(imageId, nodeImage) });
  }

  startPlan(): Node {
    return this.transitionTo(State.PLAN_STARTED);
  }

  completePlan(): Node {
    return this.transitionTo(State.PLAN_SUCCEEDED);
  }

  failPlan(): Node {
    return this.transitionTo(State.PLAN_FAILED);
  }

  startApply(): Node {
    return this.transitionTo(State.APPLY_STARTED);
  }

  completeApply(): Node {
    return this.transitionTo(State.APPLY_SUCCEEDED);
  }

  failApply(): Node {
    return this.transitionTo(State.APPLY_FAILED);
  }

  startDestroy(): Node {
    return this.transitionTo(State.DESTROY_STARTED);
  }

  completeDestroy(): Node {
    return this.transitionTo(State.DESTROY_SUCCEEDED);
  }

  failDestroy(): Node {
    return this.transitionTo(State.DESTROY_FAILED);
  }

  private transitionTo(next: State): Node {
    if (!ALLOWED[this.state].includes(next)) {
      throw new InvalidNodeStateTransition(this.state, next);
    }
    return this.withChanges({ state: next });
  }

  private withChanges(changes: {
    images?: NodeImages;
    virtualMachines?: VirtualMachines;
    state?: State;
  }): Node {
    return new Node(
      this.id,
      this.name,
      this.ip,
      this.credential,
      changes.images ?? this.images,
      changes.virtualMachines ?? this.virtualMachines,
      changes.state ?? this.state,
    );
  }
}
