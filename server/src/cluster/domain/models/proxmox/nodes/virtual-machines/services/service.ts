import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";

/**
 * Reference to a service from the service bounded context that is currently
 * running on this VM. Captured by the cluster context as a projection — the
 * service context is the source of truth for service lifecycle; this struct
 * is read-only metadata for the cluster UI ("what's running on this VM?").
 *
 * Updated by the policy `RecordVirtualMachineServicesWhenServiceInstallSucceeded` on every
 * `ServiceInstallSucceeded` event. Re-installs overwrite the existing entry for the
 * same `(serviceId, role)` pair.
 */
export class Service implements ValueObject {
  constructor(
    readonly serviceId: string,
    readonly serviceName: string,
    readonly blueprint: string,
    readonly role: string,
    readonly installedAt: Instant,
  ) {}
}
