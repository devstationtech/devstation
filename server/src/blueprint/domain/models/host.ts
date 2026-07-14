import type { Name } from "@server/blueprint/domain/models/name.ts";

/**
 * Reference declared by a hosted blueprint indicating which standalone
 * blueprint/role it runs on top of. The actual VMs come from a service of
 * `blueprint` that the operator picks at register time; the installer runs
 * the hosted blueprint's steps on the VMs of that service's role.
 */
export class Host {
  constructor(readonly blueprint: Name, readonly role: string) {
    if (!role) throw new Error("host.role is required.");
  }
}
