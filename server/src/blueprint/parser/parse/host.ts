import { Host } from "@server/blueprint/domain/models/host.ts";
import { Name } from "@server/blueprint/domain/models/name.ts";
import { mapping } from "@server/blueprint/parser/parse/primitives/mapping.ts";
import { string } from "@server/blueprint/parser/parse/primitives/string.ts";

/**
 * Parses the `host: { blueprint, role }` block declared by a hosted
 * blueprint. Returning `null` when absent is the caller's job; this parser
 * assumes the field is present and non-null.
 */
export function host({ raw, where }: { raw: unknown; where: string }): Host {
  const map = mapping({ value: raw, where });
  return new Host(
    new Name(string({ value: map.blueprint, where: `${where}.blueprint` })),
    string({ value: map.role, where: `${where}.role` }),
  );
}
