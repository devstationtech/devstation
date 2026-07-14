import { basename, dirname } from "node:path";
import { parse as parseYaml } from "@std/yaml";
import type { Blueprints } from "@server/blueprint/blueprints.ts";
import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Name } from "@server/blueprint/domain/models/name.ts";
import { parseBlueprint } from "@server/blueprint/parser/yaml.ts";
import type { SchemaValidator } from "@server/blueprint/parser/schema/schema-validator.ts";

const ENTRYPOINT = "blueprint.yaml";

export type ValidationResult = {
  valid: boolean;
  /** The declared blueprint name when valid; null otherwise. */
  name: string | null;
  /** The parser/validation error when invalid; null otherwise. */
  error: string | null;
  /** Origin of a catalog blueprint already using this name, or null if free. */
  existing: "official" | "local" | null;
};

/**
 * Validates a candidate blueprint at a local `path` with the real parser
 * — the single source of truth (structure, `${file:}`/scripts resolution,
 * domain invariants like roles-XOR-host, name format). Also reports whether
 * the declared name already exists in the merged catalog, so the caller
 * (`devstation blueprint register`) can refuse to shadow it without --force.
 *
 * `path` is either a blueprint directory (containing `blueprint.yaml`) or a
 * YAML file; assets resolve relative to that directory.
 */
export class Query {
  constructor(
    private readonly fsAt: (dir: string) => FileSystem,
    private readonly catalog: Blueprints,
    private readonly schema: SchemaValidator,
  ) {}

  async execute(path: string): Promise<ValidationResult> {
    const isYaml = /\.ya?ml$/i.test(path);
    const dir = isYaml ? dirname(path) : path;
    const entry = isYaml ? basename(path) : ENTRYPOINT;
    const fs = this.fsAt(dir);
    try {
      if (!await fs.exists(entry)) {
        return { valid: false, name: null, error: `${entry} not found at ${path}`, existing: null };
      }
      const text = await fs.read(entry);
      // Structural contract check first (matches the editor + published schema);
      // catches unknown/typo'd fields the lenient parser silently ignores. A
      // malformed YAML doc is left for the parser to report.
      let rawObject: unknown;
      try {
        rawObject = parseYaml(text);
      } catch {
        rawObject = undefined;
      }
      if (rawObject !== undefined) {
        const schemaError = await this.schema.check(rawObject);
        if (schemaError) {
          return { valid: false, name: null, error: `schema: ${schemaError}`, existing: null };
        }
      }
      const blueprint = await parseBlueprint(text, fs);
      const name = blueprint.name.value;
      const key = new Name(name);
      const existing = (await this.catalog.contains(key))
        ? (await this.catalog.entryOf(key)).origin
        : null;
      return { valid: true, name, error: null, existing };
    } catch (err) {
      return {
        valid: false,
        name: null,
        error: err instanceof Error ? err.message : String(err),
        existing: null,
      };
    }
  }
}
