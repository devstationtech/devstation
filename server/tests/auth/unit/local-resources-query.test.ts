import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query as LocalResourcesQuery } from "@server/auth/application/queries/local-resources/query.ts";
import { LinuxLocalResourcesAdapter } from "@server/auth/outbound/local-resources/linux.ts";

/**
 * `auth.resources` local-machine usage query — Linux adapter parses
 * `/proc/stat` and `/proc/meminfo`. CPU% is delta-based (first call
 * seeds, second reports). Every read path degrades to 0 on
 * missing/garbage files so the UI renders a quiet "0%" instead of
 * erroring.
 *
 * The adapter reads via `FileSystem.read`, which joins onto its root —
 * the test seeds fake `proc/stat` / `proc/meminfo` under a tempdir so
 * the absolute-looking paths resolve there.
 */

function buildQuery(dir: string): LocalResourcesQuery {
  return new LocalResourcesQuery(new LinuxLocalResourcesAdapter(new FileSystem(dir)));
}

async function withProc<T>(
  files: { stat?: string; meminfo?: string },
  fn: (q: LocalResourcesQuery) => Promise<T>,
): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "local-resources-" });
  try {
    await Deno.mkdir(join(dir, "proc"), { recursive: true });
    if (files.stat !== undefined) await Deno.writeTextFile(join(dir, "proc", "stat"), files.stat);
    if (files.meminfo !== undefined) {
      await Deno.writeTextFile(join(dir, "proc", "meminfo"), files.meminfo);
    }
    return await fn(buildQuery(dir));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

describe("LocalResourcesQuery.execute (Linux adapter)", () => {
  it("falls back to 0/0 when /proc files are absent (non-Linux / unreadable)", async () => {
    const r = await withProc({}, (q) => q.execute());
    assertEquals(r, { cpuPercent: 0, ramPercent: 0 });
  });

  it("first CPU sample returns 0 (delta needs a prior snapshot to seed)", async () => {
    /* @Given a /proc/stat with a single cpu line */
    const r = await withProc(
      { stat: "cpu  100 0 100 700 100 0 0 0 0 0\n" },
      (q) => q.execute(),
    );
    /* @Then the first read seeds the snapshot, reporting 0% */
    assertEquals(r.cpuPercent, 0);
  });

  it("second CPU sample reports the busy delta between snapshots", async () => {
    /* @Given a query that has already seeded one /proc/stat snapshot */
    const dir = await Deno.makeTempDir({ prefix: "local-resources-cpu-" });
    try {
      await Deno.mkdir(join(dir, "proc"), { recursive: true });
      const statPath = join(dir, "proc", "stat");
      const q = buildQuery(dir);
      // idle = field[3]+field[4] = 700+100 = 800; total = sum = 1100
      await Deno.writeTextFile(statPath, "cpu  100 0 100 700 100 0 0 0 0 0\n");
      await q.execute(); // seed

      /* @When a second snapshot adds 100% busy ticks (no idle growth) */
      // idle still 800; total now 1200 → idleDelta=0, totalDelta=100 → 100%
      await Deno.writeTextFile(statPath, "cpu  200 0 100 700 100 0 0 0 0 0\n");
      const r = await q.execute();

      /* @Then it reports the busy fraction, clamped into [0,100] */
      assertEquals(r.cpuPercent, 100);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  });

  it("computes RAM% from MemTotal / MemAvailable", async () => {
    /* @Given a /proc/meminfo where 1/4 of memory is available */
    const r = await withProc(
      { meminfo: "MemTotal:       8000 kB\nMemAvailable:   2000 kB\nMemFree: 1000 kB\n" },
      (q) => q.execute(),
    );
    /* @Then used = (8000-2000)/8000 = 75% */
    assertEquals(r.ramPercent, 75);
  });

  it("RAM% is 0 when MemTotal is absent (avoids divide-by-zero)", async () => {
    const r = await withProc({ meminfo: "MemFree: 1000 kB\n" }, (q) => q.execute());
    assertEquals(r.ramPercent, 0);
  });
});
