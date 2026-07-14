import { assertEquals } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { FileSystem } from "@server/shared/file-system/outbound/file-system.ts";
import { CreateVaultEndpoint } from "@server/vault/inbound/rpc/create-vault/endpoint.ts";
import { GenerateSecretEndpoint } from "@server/vault/inbound/rpc/generate-secret/endpoint.ts";
import { Query } from "@server/vault/application/queries/secrets/all/query.ts";
import { STUB_SESSION_KEY, testContainer } from "@tests/vault/fixtures/bootstrap.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

const HOSTNAME = "test-host";
const SESSION_ID = "00000000-0000-0000-0000-000000000001";
const session = {
  sessionId: SESSION_ID,
  key: STUB_SESSION_KEY,
  expiresAt: new Date(Date.now() + 60_000),
};

describe("all-secrets query — integration", () => {
  let createVault: CreateVaultEndpoint;
  let generate: GenerateSecretEndpoint;
  let query: Query;
  let persistence: Persistence;
  let vaultId: string;

  beforeEach(async () => {
    const container = testContainer();
    persistence = container.get(Persistence);
    createVault = container.get(CreateVaultEndpoint);
    generate = container.get(GenerateSecretEndpoint);
    query = container.get(Query);
    await createVault.dispatch({
      sessionId: SESSION_ID,
      name: "production",
      user: "test-user",
      hostname: "test-host",
    });
    vaultId = (await persistence.readVault("production")).id;
  });

  afterEach(() => persistence.teardown());

  it("should return empty array when vault does not exist", async () => {
    /* @Given a directory without a persisted vault */
    const isolated = new Query(new FileSystem("/nonexistent/path"));

    /* @When the query is executed */
    const records = await isolated.execute("00000000-0000-0000-0000-000000000000");

    /* @Then an empty list should be returned */
    assertEquals(records, []);
  });

  it("should return secret records without encrypted values", async () => {
    /* @Given two secrets generated in the vault */
    await generate.dispatch({
      sessionId: SESSION_ID,
      vaultId,
      name: "ssh-key",
      hostname: HOSTNAME,
      user: "test-user",
      value: null,
      description: "SSH key",
    }, session);
    await generate.dispatch({
      sessionId: SESSION_ID,
      vaultId,
      name: "api-token",
      hostname: HOSTNAME,
      user: "test-user",
      value: null,
      description: "API token",
    }, session);

    /* @When the query is executed */
    const records = await query.execute(vaultId);

    /* @Then all records should be returned without the encrypted value */
    assertEquals(records.length >= 2, true);
    for (const record of records) {
      assertEquals("value" in record, false);
    }
  });

  it("should include name and description in each record", async () => {
    /* @Given a secret with name and description */
    await generate.dispatch({
      sessionId: SESSION_ID,
      vaultId,
      name: "db-password",
      hostname: HOSTNAME,
      user: "test-user",
      value: null,
      description: "Database password",
    }, session);

    /* @When the query is executed */
    const records = await query.execute(vaultId);

    /* @Then the record should contain the name and the description */
    const record = records.find((r) => r.name === "db-password");
    assertEquals(record?.description, "Database password");
  });
});
