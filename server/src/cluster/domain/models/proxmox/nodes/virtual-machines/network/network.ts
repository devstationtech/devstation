import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Ip } from "@server/cluster/domain/models/proxmox/nodes/ip.ts";
import type { Gateway } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/gateway.ts";
import type { Dns } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/dns.ts";

export class Network implements ValueObject {
  constructor(
    readonly ip: Ip,
    readonly gateway: Gateway,
    readonly dns: Dns,
  ) {}
}
