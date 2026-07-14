import type { PublishSource } from "@server/blueprint/domain/models/step/publish-source.ts";
import { source } from "@server/blueprint/parser/parse/publish/source.ts";

/**
 * Parses a mapping of `name → PublishSource shorthand` (one of `secret:` or
 * `fact:` blocks under `publish:`). Returns `{}` when absent or null.
 */
export function sourceMap(
  { raw, where }: { raw: unknown; where: string },
): Record<string, PublishSource> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${where}: must be a mapping of name to source`);
  }
  const map: Record<string, PublishSource> = {};
  for (const [name, value] of Object.entries(raw)) {
    map[name] = source({ raw: value, where: `${where}.${name}` });
  }
  return map;
}
