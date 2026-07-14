import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import { Instant } from "@server/shared/building-blocks/domain/models/value-objects/instant.ts";
import type { User } from "@server/shared/building-blocks/domain/models/value-objects/user.ts";
import type { Hostname } from "@server/shared/building-blocks/domain/models/value-objects/hostname.ts";

export class Creation implements ValueObject {
  constructor(
    readonly by: User,
    readonly hostname: Hostname,
    readonly at: Instant,
  ) {}

  static now(by: User, hostname: Hostname): Creation {
    return new Creation(by, hostname, new Instant());
  }
}
