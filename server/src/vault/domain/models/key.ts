import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Key implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("key is required.");
  }
}
