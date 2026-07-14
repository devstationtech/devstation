import type { Policy } from "@server/shared/building-blocks/domain/ports/events/outbound/policy.ts";
import type { ServiceInstallSucceeded } from "@server/station/domain/events/service-install-succeeded.ts";
import { RecordVirtualMachineServices } from "@server/cluster/application/commands/proxmox/record-virtual-machine-services.ts";
import type { RecordVirtualMachineServicesHandler } from "@server/cluster/application/handlers/proxmox/record-virtual-machine-services-handler.ts";

/**
 * Translates a `ServiceInstallSucceeded` event into a cluster-side update of the VMs'
 * `services` projection. Reads `name` + `stack` directly off the event payload
 * — no cross-BC roundtrip into the service repository.
 */
export class RecordVirtualMachineServicesWhenServiceInstallSucceeded
  implements Policy<ServiceInstallSucceeded> {
  constructor(private readonly handler: RecordVirtualMachineServicesHandler) {}

  async on(event: ServiceInstallSucceeded): Promise<void> {
    if (event.installations.length === 0) return;
    const command = new RecordVirtualMachineServices(
      event.serviceId.value,
      event.name.value,
      event.blueprint.value,
      event.installations.map((d) => ({
        host: d.host,
        role: d.role.name,
        installedAt: d.at,
      })),
    );
    await this.handler.handle(command);
  }
}
