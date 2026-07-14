import type { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import { Service as VirtualMachineService } from "@server/cluster/domain/models/proxmox/nodes/virtual-machines/services/service.ts";

/**
 * Per-host upsert of a service projection on the cluster's VirtualMachine.
 * One command instance carries all entries from a single `ServiceInstallSucceeded`
 * event so the handler can persist each affected cluster once.
 */
export class RecordVirtualMachineServices {
  constructor(
    readonly serviceId: string,
    readonly serviceName: string,
    readonly blueprint: string,
    readonly entries: readonly { host: string; role: string; installedAt: Instant }[],
  ) {}

  toServices(): { host: string; service: VirtualMachineService }[] {
    return this.entries.map((e) => ({
      host: e.host,
      service: new VirtualMachineService(
        this.serviceId,
        this.serviceName,
        this.blueprint,
        e.role,
        e.installedAt,
      ),
    }));
  }
}
