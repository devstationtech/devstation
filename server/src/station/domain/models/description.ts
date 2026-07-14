import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

/**
 * Free-form station description. Stored alongside name for the operator's
 * own bookkeeping ("homelab-prod"); not consumed by the install logic.
 */
export class Description implements ValueObject {
  constructor(readonly value: string) {
    if (value.length > 200) throw new Error("station description must be at most 200 characters.");
  }
}
