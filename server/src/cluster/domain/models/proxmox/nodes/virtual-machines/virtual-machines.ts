import type { VirtualMachine } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machine.ts";
import type { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import type { Network } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/network.ts";

export class VirtualMachines {
  constructor(private readonly _items: VirtualMachine[] = []) {}

  get items(): readonly VirtualMachine[] {
    return [...this._items];
  }

  get length(): number {
    return this._items.length;
  }

  has(id: VirtualMachineId): boolean {
    return this._items.some((vm) => vm.id.value === id.value);
  }

  hasIp(network: Network): boolean {
    return this._items.some((vm) => vm.network.ip.value === network.ip.value);
  }

  byId(id: VirtualMachineId): VirtualMachine | null {
    return this._items.find((vm) => vm.id.value === id.value) ?? null;
  }

  byIp(network: Network): VirtualMachine | null {
    return this._items.find((vm) => vm.network.ip.value === network.ip.value) ?? null;
  }

  register(vm: VirtualMachine): VirtualMachines {
    return new VirtualMachines([...this._items, vm]);
  }

  unregister(id: VirtualMachineId): VirtualMachines {
    return new VirtualMachines(this._items.filter((vm) => vm.id.value !== id.value));
  }

  clear(): VirtualMachines {
    return new VirtualMachines();
  }
}
