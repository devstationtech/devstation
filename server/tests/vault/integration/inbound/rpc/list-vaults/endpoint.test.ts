import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { VaultCreateResponse, VaultListResponse } from "@jsonrpc-contracts-ts/vault.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/vault/fixtures/bootstrap.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

describe("vault.list endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("should return an empty list when no vault has been created yet", async () => {
    /* @Given no vault has been created */
    /* @When the client requests the vault listing */
    const response = await rpc.invoke<VaultListResponse>("vault.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then the response carries an empty list */
    assertEquals(response, []);
  });

  it("should return every persisted vault", async () => {
    /* @Given vaults are persisted */
    await rpc.invoke<VaultCreateResponse>("vault.create", {
      sessionId: STUB_SESSION_ID,
      name: "production",
      user: "alice",
      hostname: "homelab",
    });
    await rpc.invoke<VaultCreateResponse>("vault.create", {
      sessionId: STUB_SESSION_ID,
      name: "staging",
      user: "alice",
      hostname: "homelab",
    });

    /* @When the client requests the vault listing */
    const response = await rpc.invoke<VaultListResponse>("vault.list", {
      sessionId: STUB_SESSION_ID,
    });

    /* @Then the response carries every persisted vault */
    const names = response.map((v) => v.name).sort();
    assertEquals(names, ["production", "staging"]);
  });
});
