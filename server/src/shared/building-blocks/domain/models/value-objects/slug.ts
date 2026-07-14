import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Slug implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("Value is required.");
    if (value.length > 64) throw new Error("Value must be at most 64 characters.");
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(value)) {
      throw new Error("Value must be a lowercase slug (letters, digits and hyphens).");
    }
  }
}
