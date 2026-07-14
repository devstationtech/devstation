import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Encrypted implements ValueObject {
  constructor(readonly value: string) {
    if (!value.includes(":")) throw new Error("encrypted value must contain ':'.");
  }
}
