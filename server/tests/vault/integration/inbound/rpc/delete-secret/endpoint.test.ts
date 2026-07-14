import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  VaultCreateResponse,
  VaultSecretsDeleteResponse,
  VaultSecretsGenerateResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/vault/fixtures/bootstrap.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

describe("vault.secrets.delete endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let vaultId: string;

  beforeAll(async () => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);

    await rpc.invoke<VaultCreateResponse>("vault.create", {
      sessionId: STUB_SESSION_ID,
      name: "to-prune",
      user: "alice",
      hostname: "homelab",
    });
    vaultId = (await persistence.readVault("to-prune")).id;
  });

  afterAll(() => persistence.teardown());

  it("should delete an existing secret from the vault", async () => {
    /* @Given a secret is persisted in a vault */
    await rpc.invoke<VaultSecretsGenerateResponse>("vault.secrets.generate", {
      sessionId: STUB_SESSION_ID,
      vaultId,
      name: "drop-me",
      hostname: "homelab",
      user: "alice",
      value: "tmp",
    });
    const before = await persistence.readVault("to-prune");
    const secret = before.secrets.find((s) => s.name === "drop-me");
    assertEquals(secret !== undefined, true);

    /* @When the client requests removal of the secret */
    await rpc.invoke<VaultSecretsDeleteResponse>("vault.secrets.delete", {
      sessionId: STUB_SESSION_ID,
      vaultId,
      secretId: secret!.id,
    });

    /* @Then the secret is no longer present in the vault */
    const after = await persistence.readVault("to-prune");
    assertEquals(after.secrets.find((s) => s.name === "drop-me"), undefined);
  });
});
