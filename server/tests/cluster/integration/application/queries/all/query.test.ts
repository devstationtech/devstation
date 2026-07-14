import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query } from "@server/cluster/application/queries/all/query.ts";
import { testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

describe("all clusters query — integration", () => {
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

  it("should return all persisted clusters", async () => {
    /* @Given at least one persisted cluster exists */
    await persistence.writeClusters([
      {
        id: "00000000-0000-0000-0000-000000000001",
        name: "homelab-dev",
        version: 1,
        creation: { by: "alice", hostname: "192.168.1.1", at: "2026-01-01T00:00:00.000Z" },
        nodes: [],
      },
    ]);

    /* @When the query is executed */
    const records = await query.execute();

    /* @Then the persisted clusters should be returned */
    assertEquals(records.length, 1);
    assertEquals(records[0].name, "homelab-dev");
  });
});
