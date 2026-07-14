import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

const CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

export class Value implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("secret value is required.");
  }

  static generate(): Value {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let result = "";
    for (const byte of bytes) {
      result += CHARSET[byte % CHARSET.length];
    }
    return new Value(result);
  }
}
