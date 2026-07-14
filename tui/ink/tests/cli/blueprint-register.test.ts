import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import {
  registerBlueprint,
  type RegisterDeps,
  type Validation,
} from "@ui/cli/blueprint-register.ts";

/**
 * `devstation blueprint register` — branching over the engine validation
 * seam and a copy spy; no engine spawn, no real disk.
 */

const USER_DIR = "/home/u/.devstation/blueprints";

function deps(
  validation: Validation,
  copies: Array<{ src: string; dest: string }>,
): RegisterDeps {
  return {
    validate: () => Promise.resolve(validation),
    userBlueprintsDir: () => USER_DIR,
    copyDir: (src, dest) => {
      copies.push({ src, dest });
      return Promise.resolve();
    },
  };
}

describe("registerBlueprint", () => {
  it("refuses an invalid blueprint and copies nothing", async () => {
    const copies: Array<{ src: string; dest: string }> = [];
    const v: Validation = { valid: false, name: null, error: "bad yaml", existing: null };

    const result = await registerBlueprint("/tmp/x", {}, deps(v, copies));

    assertEquals(result.ok, false);
    assertStringIncludes(result.message, "bad yaml");
    assertEquals(copies.length, 0);
  });

  it("refuses to shadow an existing blueprint without --force", async () => {
    const copies: Array<{ src: string; dest: string }> = [];
    const v: Validation = { valid: true, name: "docker", error: null, existing: "official" };

    const result = await registerBlueprint("/tmp/docker", {}, deps(v, copies));

    assertEquals(result.ok, false);
    assertStringIncludes(result.message, "already exists");
    assertEquals(copies.length, 0);
  });

  it("overrides an existing blueprint with --force", async () => {
    const copies: Array<{ src: string; dest: string }> = [];
    const v: Validation = { valid: true, name: "docker", error: null, existing: "official" };

    const result = await registerBlueprint("/tmp/docker", { force: true }, deps(v, copies));

    assertEquals(result.ok, true);
    assertStringIncludes(result.message, "overrides the official");
    assertEquals(copies, [{ src: "/tmp/docker", dest: join(USER_DIR, "docker") }]);
  });

  it("registers a fresh blueprint into the user dir", async () => {
    const copies: Array<{ src: string; dest: string }> = [];
    const v: Validation = { valid: true, name: "portainer", error: null, existing: null };

    const result = await registerBlueprint("/tmp/portainer", {}, deps(v, copies));

    assertEquals(result.ok, true);
    assertStringIncludes(result.message, "Registered blueprint");
    assertEquals(copies, [{ src: "/tmp/portainer", dest: join(USER_DIR, "portainer") }]);
  });

  it("copies the parent directory when pointed at a blueprint.yaml file", async () => {
    const copies: Array<{ src: string; dest: string }> = [];
    const v: Validation = { valid: true, name: "nginx", error: null, existing: null };

    await registerBlueprint("/tmp/nginx/blueprint.yaml", {}, deps(v, copies));

    assertEquals(copies[0].src, "/tmp/nginx");
    assertEquals(copies[0].dest, join(USER_DIR, "nginx"));
  });
});
