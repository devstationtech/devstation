import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { placement } from "@server/blueprint/parser/parse/placement.ts";
import { instances } from "@server/blueprint/parser/parse/instances.ts";
import { compatibility } from "@server/blueprint/parser/parse/compatibility.ts";
import { host } from "@server/blueprint/parser/parse/host.ts";
import { envMap } from "@server/blueprint/parser/parse/env-map.ts";
import { rollback } from "@server/blueprint/parser/parse/rollback.ts";
import { source } from "@server/blueprint/parser/parse/publish/source.ts";
import { readSiblingFile } from "@server/blueprint/parser/parse/sibling-file.ts";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { join } from "@std/path";

/**
 * The small parsers all share the same shape ({raw, where} → value or
 * throw) and similar concerns (defaults, enum membership, optional vs
 * required). Grouped here so the suite stays compact; one describe per
 * parser keeps failure traces local.
 */

describe("placement parser", () => {
  it("defaults to 'exclusive' when omitted (the conservative default)", () => {
    assertEquals(placement({ raw: undefined, where: "x" }), "exclusive");
  });

  it("accepts the two valid values", () => {
    assertEquals(placement({ raw: "exclusive", where: "x" }), "exclusive");
    assertEquals(placement({ raw: "shared", where: "x" }), "shared");
  });

  it("rejects any other value with a where-aware message", () => {
    assertThrows(
      () => placement({ raw: "anywhere", where: "bp.placement" }),
      Error,
      "bp.placement",
    );
  });
});

describe("instances parser", () => {
  it("defaults to 'one' on a role when omitted", () => {
    assertEquals(instances({ raw: undefined, where: "bp.roles[0]" }), "one");
  });

  it("accepts 'one', 'many', and 'zeroOrMore'", () => {
    assertEquals(instances({ raw: "one", where: "x" }), "one");
    assertEquals(instances({ raw: "many", where: "x" }), "many");
    assertEquals(instances({ raw: "zeroOrMore", where: "x" }), "zeroOrMore");
  });

  it("rejects unknown values with the full allowed set in the message", () => {
    // The error message lists every accepted value so callers don't
    // have to keep two sources of truth in sync. This guards against
    // drift between the parser and the type union.
    try {
      instances({ raw: "five", where: "r" });
    } catch (e) {
      const msg = (e as Error).message;
      assertEquals(msg.includes("'one'"), true);
      assertEquals(msg.includes("'many'"), true);
      assertEquals(msg.includes("'zeroOrMore'"), true);
      assertEquals(msg.includes("r.instances"), true);
    }
  });
});

describe("compatibility parser", () => {
  it("accepts a non-empty list of OS strings", () => {
    /* @Given a compatibility mapping with one OS */
    const c = compatibility({ raw: { os: ["ubuntu-22-04"] }, where: "bp" });
    /* @Then it builds the Compatibility VO */
    assertEquals(c.os.length, 1);
  });

  it("rejects a missing 'os' field (the only required member)", () => {
    assertThrows(() => compatibility({ raw: {}, where: "bp" }), Error, "non-empty array");
  });

  it("rejects an empty 'os' array (a blueprint without compatibility is useless)", () => {
    assertThrows(() => compatibility({ raw: { os: [] }, where: "bp" }), Error, "non-empty array");
  });

  it("rejects non-string entries inside 'os'", () => {
    /* @Given an os list with a non-string entry */
    /* @When compatibility() is called */
    /* @Then it throws pointing at the bad index */
    assertThrows(
      () => compatibility({ raw: { os: ["ubuntu-22-04", null] }, where: "bp" }),
      Error,
      "[1]",
    );
  });

  it("rejects a non-mapping raw (string, null)", () => {
    assertThrows(() => compatibility({ raw: null, where: "bp" }), Error, "mapping");
    assertThrows(() => compatibility({ raw: "ubuntu", where: "bp" }), Error, "mapping");
  });
});

describe("host parser", () => {
  it("accepts blueprint + role", () => {
    const h = host({ raw: { blueprint: "k3s", role: "server" }, where: "bp.host" });
    assertEquals(h.blueprint.value, "k3s");
    assertEquals(h.role, "server");
  });

  it("rejects when blueprint name is missing or empty (primitives.string applies)", () => {
    assertThrows(() => host({ raw: { role: "server" }, where: "bp.host" }), Error);
    assertThrows(() => host({ raw: { blueprint: "", role: "server" }, where: "bp.host" }), Error);
  });

  it("rejects when role is missing or empty", () => {
    assertThrows(() => host({ raw: { blueprint: "k3s" }, where: "bp.host" }), Error);
    assertThrows(() => host({ raw: { blueprint: "k3s", role: "" }, where: "bp.host" }), Error);
  });

  it("rejects a non-mapping raw value", () => {
    assertThrows(() => host({ raw: null, where: "bp.host" }), Error, "mapping");
    assertThrows(() => host({ raw: "k3s", where: "bp.host" }), Error, "mapping");
  });
});

describe("envMap parser", () => {
  it("returns {} when env is undefined or null (env is optional on every step)", () => {
    assertEquals(envMap({ raw: undefined, where: "step" }), {});
    assertEquals(envMap({ raw: null, where: "step" }), {});
  });

  it("preserves string values verbatim (the template engine handles them later)", () => {
    /* @Given env={FOO: "bar"} */
    /* @When envMap() is called */
    /* @Then the value is kept as a raw string — templating happens at install time */
    assertEquals(envMap({ raw: { FOO: "bar" }, where: "step" }), { FOO: "bar" });
  });

  it("rejects an array value at any level (must be a key-value mapping)", () => {
    assertThrows(() => envMap({ raw: [1, 2], where: "step" }), Error, "mapping");
  });

  it("rejects non-string values inside the mapping", () => {
    /* @Given env with a numeric value */
    /* @When envMap is called */
    /* @Then it throws pointing at the offending key (so YAML truthy/numeric bugs surface) */
    assertThrows(() => envMap({ raw: { PORT: 8080 }, where: "step" }), Error, "PORT");
  });
});

describe("rollback parser", () => {
  it("returns null when rollback is omitted (rollback is optional)", async () => {
    const result = await rollback({ raw: undefined, fs: new FileSystem("/tmp"), where: "step" });
    assertEquals(result, null);
  });

  it("returns the shell when run is provided", async () => {
    /* @Given rollback: { run: "apt-get remove docker" } */
    const result = await rollback({
      raw: { run: "apt-get remove docker", script: null },
      fs: new FileSystem("/tmp"),
      where: "step",
    });
    assertEquals(result, "apt-get remove docker");
  });

  it("returns null when both run and script are absent (empty rollback block is a no-op)", async () => {
    /* @Given rollback: {} (no run, no script) */
    /* @When rollback() is called */
    /* @Then it returns null — operator-friendly default rather than throwing on empty block */
    const result = await rollback({
      raw: { run: null, script: null },
      fs: new FileSystem("/tmp"),
      where: "step",
    });
    assertEquals(result, null);
  });

  it("rejects a non-object raw value", async () => {
    await assertRejects(
      // deno-lint-ignore no-explicit-any
      () => rollback({ raw: "echo bye" as any, fs: new FileSystem("/tmp"), where: "step" }),
      Error,
      "mapping",
    );
  });
});

describe("publish source parser", () => {
  it("parses a 'file:' shorthand into a file source", () => {
    /* @Given a `file:` prefixed publish source */
    const s = source({ raw: "file:/var/log/token", where: "bp.publish[0]" });
    /* @Then a file-kind source with the path stripped of the prefix */
    assertEquals(s, { kind: "file", path: "/var/log/token" });
  });

  it("parses a 'stdout-line:' shorthand into a stdoutLine source", () => {
    /* @Given a `stdout-line:` prefixed publish source */
    const s = source({ raw: "stdout-line:TOKEN=", where: "bp.publish[0]" });
    /* @Then a stdoutLine-kind source carrying the prefix to match */
    assertEquals(s, { kind: "stdoutLine", prefix: "TOKEN=" });
  });

  it("rejects a non-string raw value with a where-aware message", () => {
    assertThrows(
      // deno-lint-ignore no-explicit-any
      () => source({ raw: { file: "x" } as any, where: "bp.publish[1]" }),
      Error,
      "bp.publish[1]",
    );
  });

  it("rejects an unknown prefix (must be file: or stdout-line:)", () => {
    /* @Given a raw value with neither supported prefix */
    /* @Then it throws naming the two accepted shapes */
    assertThrows(
      () => source({ raw: "http://x", where: "bp.publish[2]" }),
      Error,
      "must start with 'file:' or 'stdout-line:'",
    );
  });
});

describe("readSiblingFile", () => {
  it("resolves a relative path against the blueprint's FileSystem root", async () => {
    /* @Given a file living next to blueprint.yaml */
    const dir = await Deno.makeTempDir({ prefix: "sibling-file-" });
    try {
      await Deno.mkdir(join(dir, "scripts"));
      await Deno.writeTextFile(join(dir, "scripts", "install.sh"), "#!/bin/sh\necho hi\n");
      /* @When the relative path is read with fs rooted at the blueprint dir */
      const content = await readSiblingFile({
        path: "scripts/install.sh",
        fs: new FileSystem(dir),
      });
      /* @Then it resolves under the root */
      assertEquals(content, "#!/bin/sh\necho hi\n");
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  });

  it("rejects when the referenced file does not exist", async () => {
    const dir = await Deno.makeTempDir({ prefix: "sibling-file-miss-" });
    try {
      await assertRejects(() => readSiblingFile({ path: "missing.sh", fs: new FileSystem(dir) }));
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  });
});
