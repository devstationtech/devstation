import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";

/**
 * Host requirements declared by a blueprint. `os` is the list of guest OSes
 * the blueprint's scripts are known to work on; the register form filters
 * candidate VMs against it. Future: arch, kernel, devstation engine version.
 */
export class Compatibility implements ValueObject {
  constructor(readonly os: readonly OperatingSystem[]) {
    if (os.length === 0) {
      throw new Error("compatibility.os must list at least one supported OS.");
    }
  }
}
