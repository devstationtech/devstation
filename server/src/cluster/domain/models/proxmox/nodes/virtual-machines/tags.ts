import type { ValueObject } from "@server/shared/building-blocks/domain/models/value-objects/value-object.ts";
import { InvalidTag } from "@server/cluster/domain/exceptions/invalid-tag.ts";

const TAG = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_LENGTH = 50;

/**
 * Free-form, optional VM classification (`k3s`, `db`, `media`,
 * `client-a`). Replaces the removed role/environment value objects
 * No central catalog: tags are normalized here and reused across VMs
 * via the `cluster.proxmox.virtualMachine.tags` read query.
 *
 * Normalization is idempotent: trim, lowercase, drop empties, dedup
 * preserving first-seen order. Each surviving tag must be a lowercase
 * slug (alnum plus `.`, `-`, `_`) up to 50 chars or `InvalidTag` is
 * thrown. The empty list is valid (`Tags.empty()`).
 */
export class Tags implements ValueObject {
  readonly values: readonly string[];

  constructor(values: readonly string[] = []) {
    const normalized: string[] = [];
    for (const raw of values) {
      const tag = raw.trim().toLowerCase();
      if (tag === "") continue;
      if (tag.length > MAX_LENGTH || !TAG.test(tag)) throw new InvalidTag();
      if (!normalized.includes(tag)) normalized.push(tag);
    }
    this.values = Object.freeze(normalized);
  }

  static empty(): Tags {
    return new Tags([]);
  }

  has(tag: string): boolean {
    return this.values.includes(tag.trim().toLowerCase());
  }

  equals(other: Tags): boolean {
    return this.values.length === other.values.length &&
      this.values.every((t, i) => t === other.values[i]);
  }
}
