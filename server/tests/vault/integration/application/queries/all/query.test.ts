import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { CreateVaultEndpoint } from "@server/vault/inbound/rpc/create-vault/endpoint.ts";
import { Query } from "@server/vault/application/queries/all/query.ts";
import { testContainer } from "@tests/vault/fixtures/bootstrap.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

describe("all-vaults query — integration", () => {
  let createVault: CreateVaultEndpoint;
  let query: Query;
  let persistence: Persistence;

  beforeEach(() => {
    const container = testContainer();
    persistence = container.get(Persistence);
    createVault = container.get(CreateVaultEndpoint);
    query = container.get(Query);
  });

  afterEach(() => persistence.teardown());

  it("should return empty array when no vaults exist", async () => {
    /* @Given a directory without persisted vaults */
    const isolated = new Query(new FileSystem("/nonexistent/path"));

    /* @Then an empty list should be returned */
    assertEquals(await isolated.execute(), []);
  });

  it("should return all persisted vaults", async () => {
    /* @Given two vaults created */
    await createVault.dispatch({
      sessionId: "any",
      name: "production",
      user: "test-user",
      hostname: "test-host",
    });
    await createVault.dispatch({
      sessionId: "any",
      name: "staging",
      user: "test-user",
      hostname: "test-host",
    });

    /* @When the query is executed */
    const records = await query.execute();

    /* @Then both vaults should be returned */
    assertEquals(records.length >= 2, true);
    assertEquals(records.some((v) => v.name === "production"), true);
    assertEquals(records.some((v) => v.name === "staging"), true);
  });

  it("should include id, name and version in each record", async () => {
    /* @Given a created vault */
    await createVault.dispatch({
      sessionId: "any",
      name: "dev",
      user: "test-user",
      hostname: "test-host",
    });

    /* @When the query is executed */
    const records = await query.execute();
    const record = records.find((v) => v.name === "dev");

    /* @Then the record should contain id, name and version */
    assertEquals(typeof record?.id, "string");
    assertEquals(record?.name, "dev");
    assertEquals(record?.version, 1);
  });
});
