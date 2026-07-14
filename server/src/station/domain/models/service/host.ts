import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { Id } from "@server/station/domain/models/service/id.ts";

/**
 * Reference to the host service a hosted service runs on top of. The installer
 * resolves the host service's instances at install time and runs the hosted
 * blueprint's steps on those VMs.
 *
 * Set on hosted services (`blueprint.host` declared); null on standalone
 * services. Mutually exclusive with `Service.instances`.
 */
export class Host implements ValueObject {
  constructor(readonly service: Id, readonly role: string) {
    if (!role) throw new Error("host.role is required.");
  }
}
