import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Integer implements ValueObject {
  constructor(readonly value: number) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error("Value must be a positive integer.");
    }
  }
}
