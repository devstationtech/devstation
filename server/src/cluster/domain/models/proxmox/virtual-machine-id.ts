import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class VirtualMachineId implements ValueObject {
  constructor(readonly value: number) {
    if (!Number.isInteger(value) || value < 100) {
      throw new Error("vm id must be an integer greater than or equal to 100.");
    }
  }
}
