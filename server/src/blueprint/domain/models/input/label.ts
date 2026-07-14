import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Label implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("input label is required.");
    if (value.length > 80) throw new Error("input label must be at most 80 characters.");
  }
}
