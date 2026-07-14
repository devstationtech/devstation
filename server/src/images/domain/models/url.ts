import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export class Url implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("url is required.");
    if (!/^https?:\/\//.test(value)) throw new Error("url must start with http or https.");
  }
}
