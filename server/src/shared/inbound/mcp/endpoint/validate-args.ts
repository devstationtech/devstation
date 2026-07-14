/**
 * Lightweight JSON-Schema-shaped validator for MCP tool args.
 *
 * Why a hand-rolled validator instead of `ajv` (or similar):
 *   - We only need to catch the two failure modes that matter:
 *     missing `required` fields (a call with no `nodeIds` produced
 *     `args.nodeIds is not iterable` from the handler instead of a
 *     clean validation error) and `additionalProperties:false` being
 *     decorative (`skipTlsVerification` was silently accepted on
 *     endpoints that didn't declare it).
 *   - Adding a full ajv dep is overkill for ~30 lines of branching
 *     and locks us into a runtime dep that's awkward in `deno
 *     compile`.
 *   - `validateArgs` is **the only** schema validator in the wire
 *     path; if it ever grows enough cases to deserve ajv, swap
 *     here without touching endpoint code.
 *
 * Returns `null` on success or a human-readable string on failure.
 * The MCP registry maps the string to an `isError:true` envelope.
 */

type JsonSchema = {
  type?: "object" | "string" | "number" | "boolean" | "array" | "integer";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
};

export function validateArgs(
  args: Record<string, unknown>,
  schema: Record<string, unknown>,
): string | null {
  const s = schema as JsonSchema;
  if (s.type !== "object") return null; // only object schemas are validated today

  // Accumulate every problem before returning so a caller that hit two
  // issues (e.g. an extra field AND a missing required field) sees
  // both in one round-trip instead of fix-one-then-find-the-next.
  const errors: string[] = [];

  const required = s.required ?? [];
  for (const key of required) {
    if (!(key in args)) errors.push(`missing required field: '${key}'`);
  }

  const additionalAllowed = s.additionalProperties !== false;
  const declared = new Set(Object.keys(s.properties ?? {}));
  if (!additionalAllowed) {
    for (const key of Object.keys(args)) {
      if (!declared.has(key)) {
        errors.push(
          `unknown field: '${key}' — not declared in the tool's input schema`,
        );
      }
    }
  }

  // Lightweight per-field type check: each declared property's `type`
  // (when set) must match the JS typeof of the supplied value. Catches
  // the most common LLM mistake — passing a string id for a numeric
  // arg, etc. — without pulling in full schema validation.
  for (const [key, propSchema] of Object.entries(s.properties ?? {})) {
    if (!(key in args)) continue;
    const value = args[key];
    const expected = propSchema.type;
    if (!expected) continue;
    if (!matchesType(value, expected)) {
      errors.push(`field '${key}' must be a ${expected} (got ${describe(value)})`);
    }
  }

  return errors.length === 0 ? null : errors.join("; ");
}

function matchesType(value: unknown, expected: string): boolean {
  switch (expected) {
    case "string":
      return typeof value === "string";
    case "number":
    case "integer":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
