import type { VirtualMachineId } from "@server/cluster/domain/models/proxmox/virtual-machine-id.ts";
import type { Name } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/name.ts";
import type { Size } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/size.ts";
import { Tags } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/tags.ts";
import type { Network } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/network/network.ts";
import type { Storage } from "@server/cluster/domain/models/proxmox/nodes/storage.ts";
import type { ProxmoxResources } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/resources.ts";
import type { Secret } from "@server/shared/building-blocks/domain/models/value-objects/secret.ts";
import type { Vault } from "@server/shared/building-blocks/domain/models/value-objects/vault.ts";
import type { AssignedImage } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/assigned-image.ts";
import type { Service } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/services/service.ts";

export class VirtualMachine {
  private _services: Service[];

  constructor(
    readonly id: VirtualMachineId,
    readonly name: Name,
    readonly size: Size,
    readonly image: AssignedImage,
    readonly resources: ProxmoxResources,
    readonly network: Network,
    readonly storage: Storage,
    readonly credentialVault: Vault,
    readonly usernameSecret: Secret,
    readonly passwordSecret: Secret,
    readonly tags: Tags = Tags.empty(),
    services: readonly Service[] = [],
  ) {
    this._services = [...services];
  }

  get services(): readonly Service[] {
    return this._services;
  }

  /**
   * Upsert a service projection by `(serviceId, role)`. Re-installs of the
   * same role on this VM overwrite the entry; installs of new roles append.
   */
  recordService(service: Service): void {
    const index = this._services.findIndex(
      (s) => s.serviceId === service.serviceId && s.role === service.role,
    );
    if (index >= 0) this._services[index] = service;
    else this._services.push(service);
  }

  /** Drop every projection entry for a service (all roles) after teardown. */
  forgetService(serviceId: string): void {
    this._services = this._services.filter((s) => s.serviceId !== serviceId);
  }
}
