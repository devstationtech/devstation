import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";

/**
 * A capability a granted access token carries. Shaped `context:action`
 * or `context:group:action` (lowercase) — e.g. `clusters:read`,
 * `clusters:provision:apply`. Auth treats the value as opaque: it
 * validates the shape and compares scopes, but the catalogue of which
 * scopes exist (and the endpoint → scope map) belongs to the MCP
 * context, so auth never depends on cluster/station vocabulary.
 */
export class Scope implements ValueObject {
  private static readonly SHAPE = /^[a-z]+(?::[a-z]+){1,2}$/;

  constructor(readonly value: string) {
    if (!value) throw new Error("scope is required.");
    if (!Scope.SHAPE.test(value)) {
      throw new Error(
        `scope '${value}' must be lowercase 'context:action' or ` +
          `'context:group:action'.`,
      );
    }
  }

  equals(other: Scope): boolean {
    return this.value === other.value;
  }
}
