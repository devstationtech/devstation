import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Description implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("step description is required.");
    if (value.length > 120) throw new Error("step description must be at most 120 characters.");
  }
}
