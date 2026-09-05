import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Blueprints } from "@server/blueprint/blueprints.ts";
import { Name } from "@server/blueprint/domain/models/name.ts";
import { BlueprintNotFound } from "@server/blueprint/exceptions/blueprint-not-found.ts";

/**
 * Blueprints catalog — single source of truth for the on-disk YAML
 * blueprints (one folder per blueprint). Loads + caches the catalog
 * on first access; exposes `of`, `contains`, `list`.
 *
 * Strategy: write blueprint.yaml files to a temp dir, point a real
 * FileSystem at it. Mirrors the parser.test.ts inTempDir pattern so
 * the suite stays self-contained.
 */

async function inTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "bp-catalog-" });
  try {
    return await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

/** A minimal-but-valid standalone blueprint YAML (1 role, 1 step). */
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

async function writeBlueprint(rootDir: string, slug: string, content?: string): Promise<void> {
  const subdir = join(rootDir, slug);
  await Deno.mkdir(subdir, { recursive: true });
  await Deno.writeTextFile(join(subdir, "blueprint.yaml"), content ?? aBlueprintYaml(slug));
}

describe("Blueprints.list", () => {
  it("returns an empty list when the catalog directory has no blueprints", async () => {
    await inTempDir(async (dir) => {
      /* @Given an empty blueprints root directory */
      const catalog = new Blueprints(new FileSystem(dir));

      /* @When list() is called */
      const all = await catalog.list();

      /* @Then no blueprints are returned (and no error) */
      assertEquals(all, []);
    });
  });

  it("returns all blueprints found under the root, one per subdirectory", async () => {
    await inTempDir(async (dir) => {
      /* @Given the root has two valid blueprint subdirectories */
      await writeBlueprint(dir, "docker");
      await writeBlueprint(dir, "k3s");

      /* @When list() is called */
      const all = await new Blueprints(new FileSystem(dir)).list();

      /* @Then both are returned */
      const names = all.map((b) => b.name.value).sort();
      assertEquals(names, ["docker", "k3s"]);
    });
  });

  it("skips subdirectories that do not contain blueprint.yaml (foreign folders)", async () => {
    await inTempDir(async (dir) => {
      /* @Given one valid blueprint folder and one foreign folder (no blueprint.yaml) */
      await writeBlueprint(dir, "docker");
      await Deno.mkdir(join(dir, "scratch"));
      await Deno.writeTextFile(join(dir, "scratch", "notes.md"), "ignore me");

      /* @When list() is called */
      const all = await new Blueprints(new FileSystem(dir)).list();

      /* @Then only the valid blueprint is returned (foreign folder is silently ignored) */
      assertEquals(all.length, 1);
      assertEquals(all[0].name.value, "docker");
    });
  });
});

describe("Blueprints.of", () => {
  it("returns the matching blueprint when the name exists in the catalog", async () => {
    await inTempDir(async (dir) => {
      /* @Given a catalog with the 'docker' blueprint present */
      await writeBlueprint(dir, "docker");
      const catalog = new Blueprints(new FileSystem(dir));

      /* @When of(Name("docker")) is called */
      const bp = await catalog.of(new Name("docker"));

      /* @Then the loaded Blueprint is returned with the matching name */
      assertEquals(bp.name.value, "docker");
    });
  });

  it("throws BlueprintNotFound for an unknown name", async () => {
    await inTempDir(async (dir) => {
      /* @Given a catalog without 'missing' */
      await writeBlueprint(dir, "docker");
      const catalog = new Blueprints(new FileSystem(dir));

      /* @When of(Name("missing")) is called */
      /* @Then BlueprintNotFound is raised carrying the requested name */
      await assertRejects(
        () => catalog.of(new Name("missing")),
        BlueprintNotFound,
        "missing",
      );
    });
  });
});

describe("Blueprints.contains", () => {
  it("returns true when the named blueprint exists, false otherwise", async () => {
    await inTempDir(async (dir) => {
      /* @Given a catalog containing only 'docker' */
      await writeBlueprint(dir, "docker");
      const catalog = new Blueprints(new FileSystem(dir));

      /* @Then `contains` reflects what is actually on disk */
      assertEquals(await catalog.contains(new Name("docker")), true);
      assertEquals(await catalog.contains(new Name("k3s")), false);
    });
  });
});

describe("Blueprints — layered sources (official + user-local overlay)", () => {
  it("merges blueprints from all sources, tagging each with its origin", async () => {
    await inTempDir(async (official) => {
      await inTempDir(async (local) => {
        /* @Given docker in the official root and portainer in the user-local root */
        await writeBlueprint(official, "docker");
        await writeBlueprint(local, "portainer");

        /* @When the catalog layers official first, local last */
        const catalog = new Blueprints([
          { fs: new FileSystem(official), origin: "official" },
          { fs: new FileSystem(local), origin: "local" },
        ]);
        const entries = await catalog.entries();

        /* @Then both appear, each with the origin of its source */
        const byName = new Map(entries.map((e) => [e.blueprint.name.value, e.origin]));
        assertEquals(byName.get("docker"), "official");
        assertEquals(byName.get("portainer"), "local");
      });
    });
  });

  it("lets a user-local blueprint override an official one of the same name", async () => {
    await inTempDir(async (official) => {
      await inTempDir(async (local) => {
        /* @Given both roots declare a `docker` blueprint with different descriptions */
        await writeBlueprint(official, "docker");
        await writeBlueprint(
          local,
          "docker",
          aBlueprintYaml("docker").replace("docker blueprint", "my custom docker"),
        );

        /* @When the catalog layers official first, local last */
        const catalog = new Blueprints([
          { fs: new FileSystem(official), origin: "official" },
          { fs: new FileSystem(local), origin: "local" },
        ]);

        /* @Then only the user's version survives, tagged local */
        const all = await catalog.entries();
        const docker = all.filter((e) => e.blueprint.name.value === "docker");
        assertEquals(docker.length, 1);
        assertEquals(docker[0].origin, "local");
        assertEquals(docker[0].blueprint.description.value, "my custom docker");

        const entry = await catalog.entryOf(new Name("docker"));
        assertEquals(entry.origin, "local");
      });
    });
  });

  it("treats a missing user-local directory as contributing nothing", async () => {
    await inTempDir(async (official) => {
      /* @Given only the official root exists; the local root path does not */
      await writeBlueprint(official, "docker");
      const catalog = new Blueprints([
        { fs: new FileSystem(official), origin: "official" },
        { fs: new FileSystem(join(official, "does-not-exist")), origin: "local" },
      ]);

      /* @When entries() is called */
      const entries = await catalog.entries();

      /* @Then only the official blueprint is present (no error) */
      assertEquals(entries.map((e) => e.blueprint.name.value), ["docker"]);
      assertEquals(entries[0].origin, "official");
    });
  });

  it("defaults a single FileSystem source to the official origin", async () => {
    await inTempDir(async (dir) => {
      /* @Given a catalog built from a single FileSystem (legacy constructor form) */
      await writeBlueprint(dir, "docker");
      const catalog = new Blueprints(new FileSystem(dir));

      /* @When entries() is called */
      const entries = await catalog.entries();

      /* @Then the blueprint is tagged official */
      assertEquals(entries[0].origin, "official");
    });
  });
});

describe("Blueprints — disk-validated caching", () => {
  it("picks up a blueprint registered on disk after the first scan", async () => {
    await inTempDir(async (dir) => {
      /* @Given a catalog that has been listed once */
      await writeBlueprint(dir, "docker");
      const catalog = new Blueprints(new FileSystem(dir));
      assertEquals((await catalog.list()).length, 1);

      /* @When a new blueprint lands on disk (a `blueprint register` from
         another process — the reconnect-the-MCP pain) */
      await writeBlueprint(dir, "k3s");

      /* @Then the next read sees it without any reload/reconnect */
      const second = await catalog.list();
      assertEquals(second.map((b) => b.name.value).sort(), ["docker", "k3s"]);
      assertEquals(await catalog.contains(new Name("k3s")), true);
    });
  });

  it("re-parses a blueprint whose entrypoint changed on disk", async () => {
    await inTempDir(async (dir) => {
      /* @Given a listed catalog with the original description */
      await writeBlueprint(dir, "docker");
      const catalog = new Blueprints(new FileSystem(dir));
      assertEquals((await catalog.of(new Name("docker"))).description.value, "docker blueprint");

      /* @When the yaml is edited (mtime bumped explicitly — same-ms writes
         must not hide the change) */
      await writeBlueprint(
        dir,
        "docker",
        aBlueprintYaml("docker").replace("docker blueprint", "docker v2"),
      );
      const future = new Date(Date.now() + 5_000);
      await Deno.utime(join(dir, "docker", "blueprint.yaml"), future, future);

      /* @Then the next resolution returns the edited version */
      assertEquals((await catalog.of(new Name("docker"))).description.value, "docker v2");
    });
  });

  it("drops a blueprint removed from disk", async () => {
    await inTempDir(async (dir) => {
      /* @Given a listed catalog with two blueprints */
      await writeBlueprint(dir, "docker");
      await writeBlueprint(dir, "k3s");
      const catalog = new Blueprints(new FileSystem(dir));
      assertEquals((await catalog.list()).length, 2);

      /* @When one is deleted on disk */
      await Deno.remove(join(dir, "k3s"), { recursive: true });

      /* @Then the next read no longer offers it */
      assertEquals((await catalog.list()).map((b) => b.name.value), ["docker"]);
      assertEquals(await catalog.contains(new Name("k3s")), false);
    });
  });

  it("reuses the cached parse while the disk is unchanged", async () => {
    await inTempDir(async (dir) => {
      /* @Given a listed catalog */
      await writeBlueprint(dir, "docker");
      const catalog = new Blueprints(new FileSystem(dir));
      const first = await catalog.of(new Name("docker"));

      /* @When nothing on disk changes between reads */
      const second = await catalog.of(new Name("docker"));

      /* @Then the same parsed instance is served (no re-parse) */
      assertEquals(first === second, true);
    });
  });
});
