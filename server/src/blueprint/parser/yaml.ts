import { parse as parseYamlText } from "@std/yaml";
import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import type { Blueprint } from "@server/blueprint/domain/models/blueprint.ts";
import type { RawBlueprint } from "@server/blueprint/parser/raw/blueprint.ts";
import { blueprint } from "@server/blueprint/parser/parse/blueprint.ts";

/**
 * Parses raw `blueprint.yaml` text into a domain Blueprint. `fs` is a
 * `FileSystem` rooted at the blueprint's own directory — sibling
 * `scripts/*.sh` files and `${file:...}` references resolve through it,
 * so the parser never reaches for the runtime's file APIs directly.
 */
export function parseBlueprint(yamlText: string, fs: FileSystem): Promise<Blueprint> {
  const raw = parseYamlText(yamlText) as RawBlueprint;
  return blueprint({ raw, fs });
}
