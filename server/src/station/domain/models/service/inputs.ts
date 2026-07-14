import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

export type InputValue = string | number | boolean;

/**
 * User-supplied non-secret values consumed by stack steps via `ctx.inputs`.
 * Stored on the service so re-installs read the same values without prompting
 * the operator again.
 */
export class Inputs implements ValueObject {
  constructor(readonly values: Readonly<Record<string, InputValue>>) {}

  toRecord(): Record<string, InputValue> {
    return { ...this.values };
  }
}
