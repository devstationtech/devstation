import type { Name } from "@server/blueprint/domain/models/name.ts";
import type { OperatingSystem } from "@server/shared/building-blocks/domain/models/value-objects/operating-system.ts";

export class BlueprintOsIncompatible extends Error {
  constructor(stack: Name, os: OperatingSystem) {
    super(`stack '${stack.value}' does not support os '${os}'.`);
  }
}
