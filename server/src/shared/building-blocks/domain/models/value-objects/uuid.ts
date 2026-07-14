import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Uuid implements ValueObject {
  readonly value: string;

  constructor(value?: string) {
    this.value = value ?? crypto.randomUUID();
  }
}
