import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";

export class Expiration implements ValueObject {
  constructor(readonly at: Instant) {}

  isExpired(): boolean {
    return Date.now() > this.at.date.getTime();
  }

  static after(ttl: number): Expiration {
    return new Expiration(new Instant(new Date(Date.now() + ttl)));
  }
}
