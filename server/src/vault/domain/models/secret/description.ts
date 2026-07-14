import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Description implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("description is required.");
  }
}
