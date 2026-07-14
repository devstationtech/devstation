import type { Command } from "@server/cluster/domain/ports/inbound/command.ts";
import { VirtualMachine } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/virtual-machine.ts";
import { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import { Name } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/name.ts";
import { ProxmoxResources } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/resources.ts";
import { Cpu } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/cpu.ts";
import { Ram } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/ram.ts";
import { Disk } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/disk.ts";
import { Size } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/size.ts";
import { Tags } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/tags.ts";
import { Network } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/network.ts";
import { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import { Gateway } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/gateway.ts";
import { Dns } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/dns.ts";
import { Storage } from "@server/cluster/domain/models/proxmox/nodes/storage.ts";
import { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import { AssignedImage } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/assigned-image.ts";

export class UpdateVirtualMachine implements Command {
  constructor(
    readonly clusterId: string,
    readonly nodeId: string,
    readonly id: number,
    readonly name: string,
    readonly size: string,
    readonly image: string,
    readonly ip: string,
    readonly gateway: string,
    readonly dns: string,
    readonly storage: string,
    readonly cpu: number,
    readonly ram: number,
    readonly disk: number,
    readonly credentialVaultId: string,
    readonly usernameSecretId: string,
    readonly passwordSecretId: string,
    readonly tags: string[] = [],
  ) {}

  toVirtualMachine(): VirtualMachine {
    return new VirtualMachine(
      new VirtualMachineId(this.id),
      new Name(this.name),
      new Size(this.size),
      new AssignedImage(this.image),
      new ProxmoxResources(new Cpu(this.cpu), new Ram(this.ram), new Disk(this.disk)),
      new Network(
        new Ip(this.ip),
        new Gateway(this.gateway),
        new Dns(this.dns),
      ),
      new Storage(this.storage),
      new Vault(this.credentialVaultId),
      new Secret(this.usernameSecretId),
      new Secret(this.passwordSecretId),
      new Tags(this.tags),
    );
  }
}
