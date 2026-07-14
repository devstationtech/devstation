import Ajv2020 from "ajv/2020";
import type { ValidateFunction } from "ajv/2020";
import type { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";

const SCHEMA_FILE = "blueprint.v1.schema.json";

/**
 * Validates a raw blueprint object against the published JSON Schema
 * (`blueprint.v1.schema.json`) — the structural contract the editor modeline
 * and the CI drift-gate enforce. The hand-written parser stays the semantic
 * source of truth (roles-XOR-host, `${file:}`/script resolution, name format);
 * the schema adds what the lenient parser skips, notably rejecting unknown /
 * typo'd fields (`additionalProperties: false`).
 *
 * The schema is read once from the official blueprints root and cached. A
 * missing schema degrades to a no-op (never blocks a register), so an install
 * without the schema file still works.
 */
export class SchemaValidator {
  private validate: ValidateFunction | null | undefined = undefined;

  constructor(private readonly fs: FileSystem) {}

  private async compiled(): Promise<ValidateFunction | null> {
    if (this.validate !== undefined) return this.validate;
    try {
      const schema = JSON.parse(await this.fs.read(SCHEMA_FILE));
      // deno-lint-ignore no-explicit-any
      const ajv = new (Ajv2020 as any)({ allErrors: true, strict: false });
      this.validate = ajv.compile(schema) as ValidateFunction;
    } catch {
      this.validate = null; // schema absent/unreadable → skip structural check
    }
    return this.validate;
  }

  /** Human error string when the object violates the schema; null when it conforms (or no schema). */
  async check(raw: unknown): Promise<string | null> {
    const validate = await this.compiled();
    if (!validate) return null;
    if (validate(raw)) return null;
    return (validate.errors ?? [])
      .map((e) => `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim())
      .join("; ");
  }
}
