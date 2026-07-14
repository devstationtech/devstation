import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Blueprints } from "@server/blueprint/blueprints.ts";
import { Query as ValidateBlueprintQuery } from "@server/blueprint/application/queries/validate/query.ts";
import { SchemaValidator } from "@server/blueprint/parser/schema/schema-validator.ts";

/**
 * blueprint.validate query — validates a candidate blueprint at a local
 * path with the real parser and reports whether the name already exists in
 * the merged catalog. Backs `devstation blueprint register`.
 */

async function inTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "bp-validate-" });
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

function aBlueprintYaml(name: string): string {
  return [
    `name: ${name}`,
    `description: ${name} blueprint`,
    `version: 1.0.0`,
    `compatibility:`,
    `  os: [ubuntu-22-04]`,
    `roles:`,
    `  - name: main`,
    `    install:`,
    `      - name: install`,
    `        description: install ${name}`,
    `        run: echo ${name}`,
  ].join("\n");
}

async function writeBlueprint(rootDir: string, slug: string, content?: string): Promise<string> {
  const subdir = join(rootDir, slug);
  await Deno.mkdir(subdir, { recursive: true });
  await Deno.writeTextFile(join(subdir, "blueprint.yaml"), content ?? aBlueprintYaml(slug));
  return subdir;
}

const fsAt = (dir: string) => new FileSystem(dir);
const emptyCatalog = () => new Blueprints([]);
// Real schema lives at blueprints/blueprint.v1.schema.json (repo root cwd).
const schemaValidator = () => new SchemaValidator(new FileSystem("blueprints"));

describe("ValidateBlueprintQuery", () => {
  it("accepts a valid blueprint whose name is free in the catalog", async () => {
    await inTempDir(async (dir) => {
      const candidate = await writeBlueprint(dir, "portainer");
      const q = new ValidateBlueprintQuery(fsAt, emptyCatalog(), schemaValidator());

      const result = await q.execute(candidate);

      assertEquals(result.valid, true);
      assertEquals(result.name, "portainer");
      assertEquals(result.error, null);
      assertEquals(result.existing, null);
    });
  });

  it("reports `existing` when the name already exists (official)", async () => {
    await inTempDir(async (official) => {
      await inTempDir(async (src) => {
        await writeBlueprint(official, "docker");
        const candidate = await writeBlueprint(src, "docker");
        const catalog = new Blueprints([{ fs: new FileSystem(official), origin: "official" }]);
        const q = new ValidateBlueprintQuery(fsAt, catalog, schemaValidator());

        const result = await q.execute(candidate);

        assertEquals(result.valid, true);
        assertEquals(result.name, "docker");
        assertEquals(result.existing, "official");
      });
    });
  });

  it("reports `existing: local` when a local blueprint already uses the name", async () => {
    await inTempDir(async (local) => {
      await inTempDir(async (src) => {
        await writeBlueprint(local, "docker");
        const candidate = await writeBlueprint(src, "docker");
        const catalog = new Blueprints([{ fs: new FileSystem(local), origin: "local" }]);
        const q = new ValidateBlueprintQuery(fsAt, catalog, schemaValidator());

        assertEquals((await q.execute(candidate)).existing, "local");
      });
    });
  });

  it("rejects a malformed blueprint with an error and no name", async () => {
    await inTempDir(async (dir) => {
      const candidate = await writeBlueprint(
        dir,
        "broken",
        "name: broken\nthis is: not a valid blueprint",
      );
      const q = new ValidateBlueprintQuery(fsAt, emptyCatalog(), schemaValidator());

      const result = await q.execute(candidate);

      assertEquals(result.valid, false);
      assertEquals(result.name, null);
      assertEquals(typeof result.error, "string");
      assertEquals(result.existing, null);
    });
  });

  it("rejects a path with no blueprint.yaml", async () => {
    await inTempDir(async (dir) => {
      const q = new ValidateBlueprintQuery(fsAt, emptyCatalog(), schemaValidator());

      const result = await q.execute(dir);

      assertEquals(result.valid, false);
      assertEquals(result.error?.includes("not found"), true);
    });
  });

  it("rejects an unknown/typo'd field via the JSON schema (parser is lenient here)", async () => {
    await inTempDir(async (dir) => {
      /* @Given an otherwise-valid blueprint with a typo'd top-level key */
      const typo = aBlueprintYaml("myapp").replace("description:", "desciption:");
      const candidate = await writeBlueprint(dir, "myapp", typo);
      const q = new ValidateBlueprintQuery(fsAt, emptyCatalog(), schemaValidator());

      /* @When validated */
      const result = await q.execute(candidate);

      /* @Then the schema catches it (additionalProperties:false) with a schema-tagged error */
      assertEquals(result.valid, false);
      assertEquals(result.error?.startsWith("schema:"), true);
    });
  });

  it("accepts a path pointing directly at a blueprint.yaml file", async () => {
    await inTempDir(async (dir) => {
      const candidate = await writeBlueprint(dir, "nginx");
      const q = new ValidateBlueprintQuery(fsAt, emptyCatalog(), schemaValidator());

      const result = await q.execute(join(candidate, "blueprint.yaml"));

      assertEquals(result.valid, true);
      assertEquals(result.name, "nginx");
    });
  });
});
