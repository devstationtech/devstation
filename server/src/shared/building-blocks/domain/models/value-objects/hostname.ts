import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Hostname implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("hostname is required.");
    if (/[\r\n\t\s]/.test(value)) {
      throw new Error("hostname must not contain whitespace or control characters.");
    }
  }
}
