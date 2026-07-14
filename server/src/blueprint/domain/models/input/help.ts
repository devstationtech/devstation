import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Help implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("input help is required.");
    if (value.length > 200) throw new Error("input help must be at most 200 characters.");
  }
}
