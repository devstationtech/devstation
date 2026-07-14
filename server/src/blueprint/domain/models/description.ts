import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

/**
 * Blueprint-level human-readable description. Used by UI listings and the catalog
 * record. At most 200 characters so it fits a single line in a terminal table.
 */
export class Description implements ValueObject {
  constructor(readonly value: string) {
    if (!value) throw new Error("stack description is required.");
    if (value.length > 200) throw new Error("stack description must be at most 200 characters.");
  }
}
