import { assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { VaultCreateResponse } from "@jsonrpc-contracts-ts/vault.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/vault/fixtures/bootstrap.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

describe("vault.create endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("should create a vault and persist it", async () => {
    /* @Given a request to create a new vault */
    await rpc.invoke<VaultCreateResponse>("vault.create", {
      sessionId: STUB_SESSION_ID,
      name: "production",
      user: "alice",
      hostname: "homelab",
    });

    /* @Then the vault is persisted with no secrets */
    const vault = await persistence.readVault("production");
    assertEquals(vault.name, "production");
    assertEquals(vault.secrets.length, 0);
    assertEquals(vault.creation.by, "alice");
  });

  it("should reject creation of a vault with a duplicate name", async () => {
    /* @Given a vault already exists with the desired name */
    await rpc.invoke<VaultCreateResponse>("vault.create", {
      sessionId: STUB_SESSION_ID,
      name: "staging",
      user: "alice",
      hostname: "homelab",
    });

    /* @When a second creation with the same name is requested */
    /* @Then the server replies with a failure signalling the duplicate */
    await assertRejects(
      () =>
        rpc.invoke<VaultCreateResponse>("vault.create", {
          sessionId: STUB_SESSION_ID,
          name: "staging",
          user: "alice",
          hostname: "homelab",
        }),
      Exception,
      "already exists",
    );
  });
});
