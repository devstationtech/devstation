import { Aggregate } from "@server/shared/building-blocks/domain/models/aggregate.ts";
import type { DomainEvent } from "@server/shared/building-blocks/domain/events/domain-event.ts";
import { NodePlanStarted } from "@server/cluster/domain/events/node-plan-started.ts";
import { NodePlanSucceeded } from "@server/cluster/domain/events/node-plan-succeeded.ts";
import { NodePlanFailed } from "@server/cluster/domain/events/node-plan-failed.ts";
import { NodeApplyStarted } from "@server/cluster/domain/events/node-apply-started.ts";
import { NodeApplySucceeded } from "@server/cluster/domain/events/node-apply-succeeded.ts";
import { NodeApplyFailed } from "@server/cluster/domain/events/node-apply-failed.ts";
import { NodeDestroyStarted } from "@server/cluster/domain/events/node-destroy-started.ts";
import { NodeDestroySucceeded } from "@server/cluster/domain/events/node-destroy-succeeded.ts";
import { NodeDestroyFailed } from "@server/cluster/domain/events/node-destroy-failed.ts";
import type { Version } from "@server/shared/building-blocks/domain/models/value-objects/version.ts";
import type { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";
import type { Id } from "@server/cluster/domain/models/id.ts";
import type { Name } from "@server/cluster/domain/models/name.ts";
import type { Cluster } from "@server/cluster/domain/models/cluster.ts";
import { Provider } from "@server/cluster/domain/models/provider.ts";
import type { Id as NodeId } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { Node } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import type { VirtualMachine } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machine.ts";
import type { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import type { Network } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/network.ts";
import type { Connection } from "@server/cluster/domain/models/proxmox/connection/connection.ts";
import { Nodes } from "@server/cluster/domain/models/proxmox/nodes/nodes.ts";
import { State as NodeState } from "@server/cluster/domain/models/proxmox/nodes/state.ts";
import { NodeNotInterrupted } from "@server/cluster/domain/exceptions/node-not-interrupted.ts";
import type { Id as ImageId } from "@server/cluster/domain/models/proxmox/images/id.ts";
import type { AssignedImage } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/assigned-image.ts";
import type { NodeImage } from "@server/cluster/domain/models/proxmox/nodes/images/node-image.ts";
import type { Service as VirtualMachineService } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/services/service.ts";
import { VirtualMachineAlreadyExists } from "@server/cluster/domain/exceptions/virtual-machine-already-exists.ts";
import { VirtualMachineNotFound } from "@server/cluster/domain/exceptions/virtual-machine-not-found.ts";
import { ImageNotAssigned } from "@server/cluster/domain/exceptions/image-not-assigned.ts";
import { ImageAssignedToNode } from "@server/cluster/domain/events/image-assigned-to-node.ts";
import { ImageUnassignedFromNode } from "@server/cluster/domain/events/image-unassigned-from-node.ts";
import { VirtualMachineIdInUse } from "@server/cluster/domain/exceptions/virtual-machine-id-in-use.ts";

export class ProxmoxCluster extends Aggregate implements Cluster {
  readonly provider = Provider.PROXMOX;
  private _connection?: Connection;

  constructor(
    readonly id: Id,
    readonly name: Name,
    creation: Creation,
    readonly nodes: Nodes = new Nodes(),
    connection?: Connection,
    version?: Version,
  ) {
    super(creation, version);
    this._connection = connection;
  }

  get connection(): Connection | undefined {
    return this._connection;
  }

  connect(connection: Connection): void {
    this._connection = connection;
    this.bump();
  }

  disconnect(): void {
    this._connection = undefined;
    this.bump();
  }

  registerNode(node: Node): void {
    this.nodes.register(node);
    this.bump();
  }

  replaceNode(id: NodeId, node: Node): void {
    this.nodes.replace(id, node);
    this.bump();
  }

  unregisterNode(id: NodeId): void {
    this.nodes.remove(id);
    this.bump();
  }

  unregisterAllNodes(): void {
    this.nodes.clear();
    this.bump();
  }

  registerVirtualMachine(nodeId: NodeId, vm: VirtualMachine): void {
    const node = this.nodes.of(nodeId);
    node.ensureVirtualMachinesMutable();
    this.requireUniqueVirtualMachineId(vm.id);
    this.requireUniqueVirtualMachineIp(vm.network);
    this.requireImageAssignedToNode(vm.image, node);
    this.nodes.replaceById(nodeId, node.register(vm));
    this.bump();
  }

  replaceVirtualMachine(nodeId: NodeId, vm: VirtualMachine): void {
    const node = this.nodes.of(nodeId);
    node.ensureVirtualMachinesMutable();
    if (!node.virtualMachines.has(vm.id)) throw new VirtualMachineNotFound();
    this.requireUniqueVirtualMachineIp(vm.network, vm.id);
    this.requireImageAssignedToNode(vm.image, node);
    this.nodes.replaceById(nodeId, node.unregister(vm.id).register(vm));
    this.bump();
  }

  unregisterVirtualMachine(nodeId: NodeId, id: VirtualMachineId): void {
    const node = this.nodes.of(nodeId);
    node.ensureVirtualMachinesMutable();
    if (!node.virtualMachines.has(id)) throw new VirtualMachineNotFound();
    this.nodes.replaceById(nodeId, node.unregister(id));
    this.bump();
  }

  unregisterAllVirtualMachines(nodeId: NodeId): void {
    const node = this.nodes.of(nodeId);
    node.ensureVirtualMachinesMutable();
    this.nodes.replaceById(nodeId, node.unregisterAll());
    this.bump();
  }

  assignImage(nodeId: NodeId, nodeImage: NodeImage): void {
    const node = this.nodes.of(nodeId);
    this.requireUniqueVirtualMachineId(nodeImage.virtualMachineId);
    this.nodes.replaceById(nodeId, node.assignImage(nodeImage));
    this.events.push(
      new ImageAssignedToNode(this.id, this.name, node.id, node.name, nodeImage.imageId),
    );
    this.bump();
  }

  /** The NodeImage currently assigned for `imageId` on the node. */
  nodeImageOf(nodeId: NodeId, imageId: ImageId): NodeImage {
    return this.nodes.of(nodeId).images.of(imageId);
  }

  unassignImage(nodeId: NodeId, imageId: ImageId): void {
    const node = this.nodes.of(nodeId);
    this.requireImageNotReferencedByVirtualMachines(node, imageId);
    this.nodes.replaceById(nodeId, node.unassignImage(imageId));
    this.events.push(new ImageUnassignedFromNode(this.id, node.id, imageId));
    this.bump();
  }

  replaceAssignedImage(
    nodeId: NodeId,
    imageId: ImageId,
    nodeImage: NodeImage,
  ): void {
    const node = this.nodes.of(nodeId);
    const current = node.images.of(imageId);
    if (current.virtualMachineId.value !== nodeImage.virtualMachineId.value) {
      this.requireUniqueVirtualMachineId(nodeImage.virtualMachineId);
    }
    this.nodes.replaceById(nodeId, node.replaceAssignedImage(imageId, nodeImage));
    this.bump();
  }

  startPlan(nodeId: NodeId): void {
    this.transitionNode(nodeId, (n) => n.startPlan(), NodePlanStarted);
  }

  completePlan(nodeId: NodeId): void {
    this.transitionNode(nodeId, (n) => n.completePlan(), NodePlanSucceeded);
  }

  failPlan(nodeId: NodeId): void {
    this.transitionNode(nodeId, (n) => n.failPlan(), NodePlanFailed);
  }

  startApply(nodeId: NodeId): void {
    this.transitionNode(nodeId, (n) => n.startApply(), NodeApplyStarted);
  }

  completeApply(nodeId: NodeId): void {
    this.transitionNode(nodeId, (n) => n.completeApply(), NodeApplySucceeded);
  }

  failApply(nodeId: NodeId): void {
    this.transitionNode(nodeId, (n) => n.failApply(), NodeApplyFailed);
  }

  startDestroy(nodeId: NodeId): void {
    this.transitionNode(nodeId, (n) => n.startDestroy(), NodeDestroyStarted);
  }

  completeDestroy(nodeId: NodeId): void {
    this.transitionNode(nodeId, (n) => n.completeDestroy(), NodeDestroySucceeded);
  }

  failDestroy(nodeId: NodeId): void {
    this.transitionNode(nodeId, (n) => n.failDestroy(), NodeDestroyFailed);
  }

  /**
   * Operator acknowledges that a transient FSM state is in fact an
   * interrupted run (process crash/restart left the node wedged). Demotes
   * to the matching `*_FAILED` via the existing `fail*()` edges — no new
   * ALLOWED transitions needed. Rejects with `NodeNotInterrupted` when
   * the node isn't in a transient state, so a healthy node can't be marked
   * failed by mistake.
   */
  acknowledgeInterruption(nodeId: NodeId): void {
    const node = this.nodes.of(nodeId);
    switch (node.state) {
      case NodeState.PLAN_STARTED:
        this.failPlan(nodeId);
        return;
      case NodeState.APPLY_STARTED:
        this.failApply(nodeId);
        return;
      case NodeState.DESTROY_STARTED:
        this.failDestroy(nodeId);
        return;
      default:
        throw new NodeNotInterrupted(node.state);
    }
  }

  private transitionNode(
    nodeId: NodeId,
    transition: (n: Node) => Node,
    event: new (clusterId: Id, nodeId: NodeId) => DomainEvent,
  ): void {
    const node = this.nodes.of(nodeId);
    this.nodes.replaceById(nodeId, transition(node));
    this.events.push(new event(this.id, nodeId));
    this.bump();
  }

  /**
   * Upserts a service-projection entry on the VM identified by host. Returns
   * `true` if a matching VM was found (and the cluster mutated), `false`
   * otherwise — caller skips persisting unchanged clusters.
   */
  recordVirtualMachineService(host: string, service: VirtualMachineService): boolean {
    for (const node of this.nodes.items) {
      const vm = node.virtualMachines.items.find((v) => v.network.ip.value === host);
      if (vm) {
        vm.recordService(service);
        this.bump();
        return true;
      }
    }
    return false;
  }

  /**
   * Drops a service from the VM identified by host after teardown. Returns
   * `true` if a matching VM was found, `false` otherwise — caller skips
   * persisting unchanged clusters.
   */
  forgetVirtualMachineServices(host: string, serviceId: string): boolean {
    for (const node of this.nodes.items) {
      const vm = node.virtualMachines.items.find((v) => v.network.ip.value === host);
      if (vm) {
        vm.forgetService(serviceId);
        this.bump();
        return true;
      }
    }
    return false;
  }

  private requireVirtualMachine(
    nodeId: NodeId,
    virtualMachineId: VirtualMachineId,
  ): VirtualMachine {
    const node = this.nodes.of(nodeId);
    const vm = node.virtualMachines.byId(virtualMachineId);
    if (!vm) throw new VirtualMachineNotFound();
    return vm;
  }

  private requireUniqueVirtualMachineId(id: VirtualMachineId): void {
    for (const node of this.nodes.items) {
      if (node.virtualMachines.has(id)) throw new VirtualMachineAlreadyExists("virtualMachineId");
      if (node.images.byVirtualMachineId(id)) throw new VirtualMachineIdInUse(id.value);
    }
  }

  private requireImageAssignedToNode(ref: AssignedImage, node: Node): void {
    if (!node.images.byImage(ref)) throw new ImageNotAssigned(ref.value);
  }

  private requireImageNotReferencedByVirtualMachines(node: Node, imageId: ImageId): void {
    for (const vm of node.virtualMachines.items) {
      if (vm.image.value === imageId.value) {
        throw new Error(
          `image ${imageId.value} is referenced by vm ${vm.name.value} on node ${node.name.value}`,
        );
      }
    }
  }

  private requireUniqueVirtualMachineIp(network: Network, skipId?: VirtualMachineId): void {
    for (const node of this.nodes.items) {
      const existing = node.virtualMachines.byIp(network);
      if (!existing) continue;
      if (skipId && existing.id.value === skipId.value) continue;
      throw new VirtualMachineAlreadyExists("address");
    }
  }

  static register(id: Id, name: Name, creation: Creation): ProxmoxCluster {
    return new ProxmoxCluster(id, name, creation);
  }
}
