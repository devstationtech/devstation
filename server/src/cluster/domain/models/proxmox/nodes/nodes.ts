import type { Node } from "@server/cluster/domain/models/proxmox/nodes/node.ts";
import type { Id } from "@server/cluster/domain/models/proxmox/nodes/id.ts";
import type { Name } from "@server/cluster/domain/models/proxmox/nodes/name.ts";
import type { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { NodeNotFound } from "@server/cluster/domain/exceptions/node-not-found.ts";
import { NodeAlreadyExists } from "@server/cluster/domain/exceptions/node-already-exists.ts";
import { NodeHasVirtualMachines } from "@server/cluster/domain/exceptions/node-has-virtual-machines.ts";

export class Nodes {
  constructor(private readonly _items: Node[] = []) {}

  get items(): readonly Node[] {
    return [...this._items];
  }

  get length(): number {
    return this._items.length;
  }

  byId(id: Id): Node | null {
    return this._items.find((n) => n.id.value === id.value) ?? null;
  }

  byName(name: Name): Node | null {
    return this._items.find((n) => n.name.value === name.value) ?? null;
  }

  byIp(ip: Ip): Node | null {
    return this._items.find((n) => n.ip.value === ip.value) ?? null;
  }

  register(node: Node): void {
    if (this.byName(node.name)) throw new NodeAlreadyExists("name");
    if (this.byIp(node.ip)) throw new NodeAlreadyExists("ip");
    this._items.push(node);
  }

  replace(id: Id, node: Node): void {
    const index = this.indexOf(id);
    const byName = this.byName(node.name);
    if (byName && byName.id.value !== id.value) throw new NodeAlreadyExists("name");
    const byIp = this.byIp(node.ip);
    if (byIp && byIp.id.value !== id.value) throw new NodeAlreadyExists("ip");
    this._items[index] = node;
  }

  remove(id: Id): void {
    const index = this.indexOf(id);
    if (this._items[index].virtualMachines.length > 0) throw new NodeHasVirtualMachines();
    this._items.splice(index, 1);
  }

  clear(): void {
    if (this._items.some((n) => n.virtualMachines.length > 0)) throw new NodeHasVirtualMachines();
    this._items.splice(0, this._items.length);
  }

  replaceById(id: Id, node: Node): void {
    const index = this.indexOf(id);
    this._items[index] = node;
  }

  of(id: Id): Node {
    const node = this.byId(id);
    if (!node) throw new NodeNotFound();
    return node;
  }

  private indexOf(id: Id): number {
    const index = this._items.findIndex((n) => n.id.value === id.value);
    if (index === -1) throw new NodeNotFound();
    return index;
  }
}
