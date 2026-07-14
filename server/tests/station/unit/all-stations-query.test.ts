import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "@std/path";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import {
  deriveServiceStats,
  deriveStationStatus,
  Query as AllStationsQuery,
} from "@server/station/application/queries/all/query.ts";

/**
 * `station.list` query — the station-level rollup. `deriveStationStatus`
 * and `deriveServiceStats` are pure projections of the services' status
 * column; the precedence between them matters (a single INSTALLING wins
 * over everything, then all-INSTALLED, then FAILED, then ABORTED). Tests
 * pin every branch + the precedence order, then a tempdir round-trip
 * for `Query.execute`.
 */

const svc = (status: string) => ({ status });

describe("deriveStationStatus", () => {
  it("an empty station (no services) is REGISTERED", () => {
    assertEquals(deriveStationStatus([]), "REGISTERED");
  });

  it("any INSTALLING service makes the station INSTALLING (highest precedence)", () => {
    /* @Given a mix where at least one service is mid-install */
    /* @Then INSTALLING wins even over FAILED/INSTALLED siblings */
    assertEquals(
      deriveStationStatus([svc("INSTALLED"), svc("INSTALLING"), svc("FAILED")]),
      "INSTALLING",
    );
  });

  it("all services INSTALLED makes the station INSTALLED", () => {
    assertEquals(deriveStationStatus([svc("INSTALLED"), svc("INSTALLED")]), "INSTALLED");
  });

  it("a FAILED service (none installing, not all installed) makes the station FAILED", () => {
    assertEquals(deriveStationStatus([svc("INSTALLED"), svc("FAILED")]), "FAILED");
  });

  it("an ABORTED service (no installing/failed) makes the station ABORTED", () => {
    assertEquals(deriveStationStatus([svc("INSTALLED"), svc("ABORTED")]), "ABORTED");
  });

  it("FAILED takes precedence over ABORTED when both are present", () => {
    /* @Given one failed and one aborted service, none installing */
    /* @Then FAILED wins — the check order is failed-before-aborted */
    assertEquals(deriveStationStatus([svc("FAILED"), svc("ABORTED")]), "FAILED");
  });

  it("only-REGISTERED services keep the station REGISTERED (fallthrough)", () => {
    assertEquals(deriveStationStatus([svc("REGISTERED"), svc("REGISTERED")]), "REGISTERED");
  });
});

describe("deriveServiceStats", () => {
  it("counts each status into its own bucket", () => {
    /* @Given a station with every status represented */
    const stats = deriveServiceStats([
      svc("REGISTERED"),
      svc("INSTALLING"),
      svc("INSTALLED"),
      svc("INSTALLED"),
      svc("FAILED"),
      svc("ABORTED"),
    ]);
    /* @Then each bucket holds its exact count */
    assertEquals(stats, { registered: 1, installing: 1, installed: 2, failed: 1, aborted: 1 });
  });

  it("returns all-zero buckets for an empty station", () => {
    assertEquals(deriveServiceStats([]), {
      registered: 0,
      installing: 0,
      installed: 0,
      failed: 0,
      aborted: 0,
    });
  });

  it("ignores unknown status strings (no bucket, no throw)", () => {
    /* @Given a service carrying a status the projection doesn't know */
    /* @Then it lands in no bucket — the rollup degrades gracefully */
    assertEquals(deriveServiceStats([svc("WAT")]), {
      registered: 0,
      installing: 0,
      installed: 0,
      failed: 0,
      aborted: 0,
    });
  });
});

describe("AllStationsQuery.execute", () => {
  async function withStations<T>(
    raw: unknown,
    fn: (q: AllStationsQuery) => Promise<T>,
  ): Promise<T> {
    const dir = await Deno.makeTempDir({ prefix: "station-all-query-" });
    try {
      await Deno.writeTextFile(join(dir, "stations.json"), JSON.stringify(raw));
      return await fn(new AllStationsQuery(new FileSystem(dir)));
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  }

  it("returns an empty list when nothing is persisted", async () => {
    const records = await withStations([], (q) => q.execute());
    assertEquals(records, []);
  });

  it("projects each station with derived status + serviceCount + stats", async () => {
    /* @Given one station with two services (one installed, one failed) */
    const records = await withStations(
      [{
        id: "s1",
        name: "homelab",
        description: "dev station",
        services: [{ status: "INSTALLED" }, { status: "FAILED" }],
      }],
      (q) => q.execute(),
    );
    /* @Then the record carries the rollup the wire layer expects */
    assertEquals(records.length, 1);
    assertEquals(records[0].id, "s1");
    assertEquals(records[0].name, "homelab");
    assertEquals(records[0].status, "FAILED");
    assertEquals(records[0].serviceCount, 2);
    assertEquals(records[0].serviceStats.installed, 1);
    assertEquals(records[0].serviceStats.failed, 1);
  });

  it("treats a station with no `services` field as zero services (REGISTERED)", async () => {
    /* @Given a persisted station missing the services array entirely */
    const records = await withStations(
      [{ id: "s2", name: "fresh", description: "" }],
      (q) => q.execute(),
    );
    /* @Then it projects as an empty REGISTERED station (no crash on undefined) */
    assertEquals(records[0].status, "REGISTERED");
    assertEquals(records[0].serviceCount, 0);
  });
});
