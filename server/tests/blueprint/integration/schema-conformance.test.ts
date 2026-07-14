import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { parse as parseYaml } from "@std/yaml";
import Ajv2020 from "ajv/2020";

/**
 * Anti-drift gate: the published JSON Schema (`blueprint.v1.schema.json`) is a
 * real contract, not decoration. Every shipped blueprint MUST validate against
 * it, and the schema itself MUST be a compilable draft-2020-12 document. If a
 * DSL change lands in the parser + a blueprint uses it, this fails until the
 * schema is updated — the two can no longer silently diverge.
 */

const CATALOG_ROOT = "blueprints";
const SCHEMA_PATH = `${CATALOG_ROOT}/blueprint.v1.schema.json`;

async function catalogBlueprints(): Promise<{ name: string; path: string }[]> {
  const out: { name: string; path: string }[] = [];
  for await (const entry of Deno.readDir(CATALOG_ROOT)) {
    if (!entry.isDirectory) continue;
    const path = `${CATALOG_ROOT}/${entry.name}/blueprint.yaml`;
    try {
      await Deno.stat(path);
      out.push({ name: entry.name, path });
    } catch {
      // dir without a blueprint.yaml — not a blueprint
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

describe("blueprint catalog — JSON Schema conformance", () => {
  it("compiles the schema and validates every shipped blueprint against it", async () => {
    const schema = JSON.parse(await Deno.readTextFile(SCHEMA_PATH));
    // deno-lint-ignore no-explicit-any
    const ajv = new (Ajv2020 as any)({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);

    const blueprints = await catalogBlueprints();
    assert(blueprints.length > 0, "expected at least one blueprint in the catalog");

    const failures: string[] = [];
    for (const bp of blueprints) {
      const doc = parseYaml(await Deno.readTextFile(bp.path));
      if (!validate(doc)) {
        const errs = (validate.errors ?? [])
          .map((e: { instancePath?: string; message?: string }) =>
            `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim()
          )
          .join("; ");
        failures.push(`${bp.name}: ${errs}`);
      }
    }
    assertEquals(failures, [], `blueprints violating the v1 schema:\n${failures.join("\n")}`);
  });
});
