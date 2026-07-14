import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { Query } from "@server/cluster/application/queries/by-id/query.ts";
import { testContainer } from "@tests/cluster/fixtures/bootstrap.ts";
import { Persistence } from "@tests/cluster/integration/outbound/persistence.ts";

describe("cluster by-id query — integration", () => {
  let query: Query;
  let persistence: Persistence;

  beforeEach(async () => {
    const c = testContainer();
    persistence = c.get(Persistence);
    query = c.get(Query);
    await persistence.writeClusters([
      {
        id: "cluster-001",
        name: "homelab-prod",
        version: 2,
        creation: { by: "alice", hostname: "host-1", at: "2026-01-01T00:00:00.000Z" },
        nodes: [],
      },
    ]);
  });

  afterEach(() => persistence.teardown());

  it("should return null when file does not exist", async () => {
    /* @Given a path with no data file */
    const isolated = new Query(new FileSystem("/nonexistent/path"));

    /* @When the query is executed */
    const result = await isolated.execute("any-id");

    /* @Then null should be returned */
    assertEquals(result, null);
  });

  it("should return null for an unknown cluster id", async () => {
    /* @Given a file with persisted clusters */
    /* @When the query is executed with a nonexistent id */
    const result = await query.execute("unknown-id");

    /* @Then null should be returned */
    assertEquals(result, null);
  });

  it("should return the cluster record", async () => {
    /* @Given a persisted cluster */
    /* @When the query is executed with the correct id */
    const result = await query.execute("cluster-001");

    /* @Then the cluster record should be returned */
    assertEquals(result?.id, "cluster-001");
    assertEquals(result?.name, "homelab-prod");
    assertEquals(result?.version, 2);
  });
});
