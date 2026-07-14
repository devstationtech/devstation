import { assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Exception } from "@jsonrpc-client-ts/exception.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type { VaultCreateResponse, VaultDeleteResponse } from "@jsonrpc-contracts-ts/vault.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/vault/fixtures/bootstrap.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

describe("vault.delete endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;

  beforeAll(() => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);
  });

  afterAll(() => persistence.teardown());

  it("should delete an existing vault", async () => {
    /* @Given a persisted vault */
    await rpc.invoke<VaultCreateResponse>("vault.create", {
      sessionId: STUB_SESSION_ID,
      name: "to-remove",
      user: "alice",
      hostname: "homelab",
    });
    const stored = await persistence.readVault("to-remove");

    /* @When the client requests removal by vault id */
    await rpc.invoke<VaultDeleteResponse>("vault.delete", {
      sessionId: STUB_SESSION_ID,
      vaultId: stored.id,
    });

    /* @Then the vault is no longer persisted */
    await assertRejects(() => persistence.readVault("to-remove"));
  });

  it("should reject removal when the vault id is unknown", async () => {
    /* @Given a nonexistent vault identifier */
    /* @When the client requests removal */
    /* @Then the server replies with a failure signalling vault not found */
    await assertRejects(
      () =>
        rpc.invoke<VaultDeleteResponse>("vault.delete", {
          sessionId: STUB_SESSION_ID,
          vaultId: "00000000-0000-0000-0000-000000000000",
        }),
      Exception,
      "not found",
    );
  });
});
