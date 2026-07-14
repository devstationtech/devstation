import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import type { PublishSource } from "@server/blueprint/domain/models/step/publish-source.ts";

/**
 * Values a step exposes after a successful run. `secrets` end up in the
 * service vault; `facts` are non-secret outputs visible in the UI.
 */
export class Publish implements ValueObject {
  constructor(
    readonly secrets: Readonly<Record<string, PublishSource>>,
    readonly facts: Readonly<Record<string, PublishSource>>,
  ) {}
}
