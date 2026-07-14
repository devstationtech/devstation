import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class User implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("user is required.");
  }
}
