import type { Entity } from "@server/shared/building-blocks/domain/models/entity.ts";
import type { Id } from "@server/vault/domain/models/secret/id.ts";
import type { Name } from "@server/vault/domain/models/secret/name.ts";
import type { Encrypted } from "@server/vault/domain/models/secret/encrypted.ts";
import type { Description } from "@server/vault/domain/models/secret/description.ts";
import type { Creation } from "@server/shared/building-blocks/domain/models/value-objects/creation.ts";

export class Secret implements Entity {
  constructor(
    readonly id: Id,
    readonly name: Name,
    readonly value: Encrypted,
    readonly description: Description | null,
    readonly creation: Creation,
  ) {}
}
