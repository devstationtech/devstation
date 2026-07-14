import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Instant implements ValueObject {
  constructor(readonly date: Date = new Date()) {
    if (isNaN(date.getTime())) throw new Error("invalid instant value.");
  }

  static fromString(value: string): Instant {
    return new Instant(new Date(value));
  }

  toString(): string {
    return this.date.toISOString();
  }
}
