import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Blueprints } from "@server/blueprint/blueprints.ts";
import { Query as AllQuery } from "@server/blueprint/application/queries/all/query.ts";
import { Query as ByIdQuery } from "@server/blueprint/application/queries/by-id/query.ts";

/**
 * Query handlers translate the domain Blueprint to the BlueprintRecord
 * DTO. They are thin but encode two important contracts: (1) the by-id
 * query swallows BlueprintNotFound and returns null (so the endpoint
 * can decide how to surface it), (2) the all query order/shape matches
 * what the wire layer expects.
 */

async function withCatalog<T>(
  setup: (rootDir: string) => Promise<void>,
  fn: (catalog: Blueprints) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "bp-queries-" });
  try {
    await setup(dir);
    return await fn(new Blueprints(new FileSystem(dir)));
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

async function writeBlueprint(rootDir: string, slug: string): Promise<void> {
  const subdir = join(rootDir, slug);
  await Deno.mkdir(subdir, { recursive: true });
  await Deno.writeTextFile(join(subdir, "blueprint.yaml"), aBlueprintYaml(slug));
}

describe("AllBlueprintsQuery", () => {
  it("returns one record per blueprint in the catalog", async () => {
    /* @Given a catalog with two blueprints */
    await withCatalog(
      async (dir) => {
        await writeBlueprint(dir, "docker");
        await writeBlueprint(dir, "k3s");
      },
      async (catalog) => {
        /* @When AllBlueprintsQuery.execute() is called */
        const records = await new AllQuery(catalog).execute();
        /* @Then both blueprints are present in the DTO list */
        assertEquals(records.length, 2);
        const names = records.map((r) => r.name).sort();
        assertEquals(names, ["docker", "k3s"]);
      },
    );
  });

  it("returns an empty list when the catalog has no blueprints", async () => {
    await withCatalog(
      () => Promise.resolve(),
      async (catalog) => {
        const records = await new AllQuery(catalog).execute();
        assertEquals(records, []);
      },
    );
  });
});

describe("BlueprintByIdQuery", () => {
  it("returns a BlueprintRecord when the name exists", async () => {
    /* @Given the catalog contains 'docker' */
    await withCatalog(
      (dir) => writeBlueprint(dir, "docker"),
      async (catalog) => {
        /* @When ByIdQuery.execute("docker") is called */
        const record = await new ByIdQuery(catalog).execute("docker");
        /* @Then it returns the record (not null) */
        assertEquals(record?.name, "docker");
      },
    );
  });

  it("returns null (NOT throws) when the blueprint is not found", async () => {
    /* @Given a catalog with only 'docker' */
    await withCatalog(
      (dir) => writeBlueprint(dir, "docker"),
      async (catalog) => {
        /* @When ByIdQuery.execute("missing") is called */
        /* @Then it returns null — the by-id endpoint decides how to surface that */
        /*       (RPC layer turns null into a not-found error; UI may show "not found") */
        const record = await new ByIdQuery(catalog).execute("missing");
        assertEquals(record, null);
      },
    );
  });

  it("propagates non-NotFound errors (e.g. invalid name format) without swallowing", async () => {
    /* @Given the catalog (irrelevant) */
    await withCatalog(
      () => Promise.resolve(),
      async (catalog) => {
        /* @When execute is called with an empty string (Name VO rejects it) */
        /* @Then the underlying error propagates — only BlueprintNotFound is swallowed to null */
        await assertRejects(() => new ByIdQuery(catalog).execute(""), Error);
      },
    );
  });
});
