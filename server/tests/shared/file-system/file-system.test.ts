import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";

/**
 * FileSystem is the disk facade every BC depends on (clusters.json,
 * vaults.json, stations.json, blueprints/ directory). It owns the
 * file-mode policy (0o600 / 0o700) that keeps secret-bearing files
 * out of group/other read.
 *
 * Tests use a real temp directory — the class is a thin Deno.fs
 * wrapper and is cheapest to exercise against the real fs.
 */
async function withFs<T>(fn: (fs: FileSystem, dir: string) => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "fs-test-" });
  try {
    return await fn(new FileSystem(dir), dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

describe("FileSystem.read / write", () => {
  it("round-trips a string through write → read", async () => {
    await withFs(async (fs) => {
      /* @Given a fresh FileSystem */
      /* @When write then read of the same filename */
      await fs.write("notes.txt", "hello world");
      const got = await fs.read("notes.txt");
      /* @Then the same content is returned */
      assertEquals(got, "hello world");
    });
  });

  it("creates the parent directory when writing to a nested path", async () => {
    await withFs(async (fs, dir) => {
      /* @Given a path with a non-existent parent */
      /* @When write is called */
      await fs.write("nested/dir/notes.txt", "x");
      /* @Then both parent and file exist */
      const stat = await Deno.stat(join(dir, "nested/dir/notes.txt"));
      assertEquals(stat.isFile, true);
    });
  });

  it("write sets owner-only (0o600) file mode — secrets must not leak via mode bits", async () => {
    await withFs(async (fs, dir) => {
      /* @Given a file freshly written via FileSystem.write */
      await fs.write("vault.json", "secret");
      /* @Then the file is 0o600 (owner read+write only) */
      const stat = await Deno.stat(join(dir, "vault.json"));
      /* mode is the full st_mode; mask the permission bits */
      assertEquals(stat.mode! & 0o777, 0o600);
    });
  });
});

describe("FileSystem.readObjectOf", () => {
  it("returns null when the file does not exist (not a throw)", async () => {
    await withFs(async (fs) => {
      /* @Given the file does not exist */
      /* @When readObjectOf is called */
      /* @Then it returns null — the BC layer treats that as "no record" */
      const value = await fs.readObjectOf<{ id: string }>("missing.json");
      assertEquals(value, null);
    });
  });

  it("returns null when the file is blank or whitespace-only", async () => {
    await withFs(async (fs) => {
      /* @Given a file with only whitespace */
      await fs.write("blank.json", "   \n");
      /* @When readObjectOf is called */
      /* @Then it returns null — empty files behave like missing */
      const value = await fs.readObjectOf<unknown>("blank.json");
      assertEquals(value, null);
    });
  });

  it("parses and returns the JSON object when present", async () => {
    await withFs(async (fs) => {
      await fs.writeObjectOf("config.json", { foo: 1 });
      const value = await fs.readObjectOf<{ foo: number }>("config.json");
      assertEquals(value, { foo: 1 });
    });
  });

  it("propagates non-NotFound errors (e.g. permission denied) — only NotFound is swallowed", async () => {
    await withFs(async (fs) => {
      /* @Given a file that contains invalid JSON */
      await fs.write("bad.json", "{not-json}");
      /* @When readObjectOf is called */
      /* @Then it throws (JSON.parse error propagates — not silently null) */
      await assertRejects(() => fs.readObjectOf("bad.json"), SyntaxError);
    });
  });
});

describe("FileSystem.readObjectsOf", () => {
  it("returns [] when the file does not exist", async () => {
    await withFs(async (fs) => {
      const items = await fs.readObjectsOf<{ id: string }>("missing.json");
      assertEquals(items, []);
    });
  });

  it("returns [] when the file is blank", async () => {
    await withFs(async (fs) => {
      await fs.write("empty.json", "");
      assertEquals(await fs.readObjectsOf<unknown>("empty.json"), []);
    });
  });

  it("round-trips an array via writeObjectsOf → readObjectsOf", async () => {
    await withFs(async (fs) => {
      const items = [{ id: "a" }, { id: "b" }];
      await fs.writeObjectsOf("list.json", items);
      assertEquals(await fs.readObjectsOf<{ id: string }>("list.json"), items);
    });
  });
});

describe("FileSystem.append", () => {
  it("appends to an existing file without truncating", async () => {
    await withFs(async (fs) => {
      /* @Given a file with initial content */
      await fs.write("log.txt", "line1\n");
      /* @When append is called twice */
      await fs.append("log.txt", "line2\n");
      await fs.append("log.txt", "line3\n");
      /* @Then all three lines are present in order */
      assertEquals(await fs.read("log.txt"), "line1\nline2\nline3\n");
    });
  });

  it("creates the file (and dirs) if missing on first append", async () => {
    await withFs(async (fs) => {
      /* @Given no file exists yet */
      /* @When append is called */
      await fs.append("nested/audit.log", "first\n");
      /* @Then the file is created with just the appended content */
      assertEquals(await fs.read("nested/audit.log"), "first\n");
    });
  });
});

describe("FileSystem.exists / delete", () => {
  it("exists is true after write, false before, false after delete", async () => {
    await withFs(async (fs) => {
      assertEquals(await fs.exists("t.txt"), false);
      await fs.write("t.txt", "ok");
      assertEquals(await fs.exists("t.txt"), true);
      await fs.delete("t.txt");
      assertEquals(await fs.exists("t.txt"), false);
    });
  });

  it("delete throws when the file does not exist (caller decides idempotency)", async () => {
    await withFs(async (fs) => {
      await assertRejects(() => fs.delete("nope.txt"), Deno.errors.NotFound);
    });
  });
});

describe("FileSystem.list / listDirs", () => {
  it("list returns only files (not directories)", async () => {
    await withFs(async (fs, dir) => {
      /* @Given a mixed tree: 2 files + 1 directory at root */
      await fs.write("a.txt", "");
      await fs.write("b.txt", "");
      await Deno.mkdir(join(dir, "sub"));
      /* @When list is called */
      const files = (await fs.list()).sort();
      /* @Then only the two files are returned */
      assertEquals(files, ["a.txt", "b.txt"]);
    });
  });

  it("listDirs returns only directories (not files)", async () => {
    await withFs(async (fs, dir) => {
      await Deno.mkdir(join(dir, "alpha"));
      await Deno.mkdir(join(dir, "beta"));
      await fs.write("ignored.txt", "");
      const dirs = (await fs.listDirs()).sort();
      assertEquals(dirs, ["alpha", "beta"]);
    });
  });

  it("list / listDirs return [] (not throw) when the root directory itself does not exist", async () => {
    /* @Given a FileSystem pointing at a non-existent path */
    const fs = new FileSystem("/tmp/does-not-exist-" + Math.random());
    /* @Then both list and listDirs return empty arrays — bc startup is tolerant */
    assertEquals(await fs.list(), []);
    assertEquals(await fs.listDirs(), []);
  });
});

describe("FileSystem.subdir / resolve", () => {
  it("subdir returns a new FileSystem rooted at the joined path", async () => {
    await withFs(async (fs, dir) => {
      /* @Given a child directory exists */
      await Deno.mkdir(join(dir, "child"));
      const child = fs.subdir("child");
      /* @When write on the child */
      await child.write("hi.txt", "yo");
      /* @Then the file is at <root>/child/hi.txt */
      const got = await Deno.readTextFile(join(dir, "child", "hi.txt"));
      assertEquals(got, "yo");
    });
  });

  it("resolve composes the root + filename into an absolute path", async () => {
    await withFs((fs, dir) => {
      assertEquals(fs.resolve("a.txt"), join(dir, "a.txt"));
      return Promise.resolve();
    });
  });
});
