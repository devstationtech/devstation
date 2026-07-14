import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query } from "@server/size/application/queries/all/query.ts";
import { testContainer } from "@tests/size/fixtures/bootstrap.ts";
import { Persistence } from "@tests/size/integration/outbound/persistence.ts";

describe("all sizes query — integration", () => {
  let query: Query;
  let persistence: Persistence;

  beforeEach(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    query = c.get(Query);
  });

  afterEach(() => persistence.teardown());

  it("should return empty array when file does not exist", async () => {
    /* @Given a path with no data file */
    const isolated = new Query(new FileSystem("/nonexistent/path"));

    /* @When the query is executed */
    const records = await isolated.execute();

    /* @Then an empty list should be returned */
    assertEquals(records, []);
  });

  it("should return all persisted sizes", async () => {
    /* @Given at least one persisted size exists */
    await persistence.writeSizes([
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "vm-sm",
        provider: "proxmox",
        version: 1,
        cpu: 2,
        ram: 2048,
        disk: 20,
        creation: { by: "alice", hostname: "devstation", at: "2026-01-01T00:00:00.000Z" },
      },
    ]);

    /* @When the query is executed */
    const records = await query.execute();

    /* @Then the persisted sizes should be returned */
    assertEquals(records.length, 1);
    assertEquals(records[0].name, "vm-sm");
    assertEquals(records[0].provider, "proxmox");
  });
});
