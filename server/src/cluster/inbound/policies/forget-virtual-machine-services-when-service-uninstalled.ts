import type { Policy } from "@server/shared/building-blocks/domain/ports/events/outbound/policy.ts";
import type { ServiceUninstalled } from "@server/station/domain/events/service-uninstalled.ts";
import { ForgetVirtualMachineServices } from "@server/cluster/application/commands/proxmox/forget-virtual-machine-services.ts";
import type { ForgetVirtualMachineServicesHandler } from "@server/cluster/application/handlers/proxmox/forget-virtual-machine-services-handler.ts";

/**
 * Inverse of `RecordVirtualMachineServicesWhenServiceInstallSucceeded`: when a
 * service is torn down, drops it from each VM's `services` projection. The
 * projection is a dumb sink — station is the source of truth.
 */
export class ForgetVirtualMachineServicesWhenServiceUninstalled
  implements Policy<ServiceUninstalled> {
  constructor(private readonly handler: ForgetVirtualMachineServicesHandler) {}

  async on(event: ServiceUninstalled): Promise<void> {
    if (event.installations.length === 0) return;
    const hosts = [...new Set(event.installations.map((d) => d.host))];
    await this.handler.handle(new ForgetVirtualMachineServices(event.serviceId.value, hosts));
  }
}
