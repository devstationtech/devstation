import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  VaultCreateResponse,
  VaultSecretsGenerateResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/vault/fixtures/bootstrap.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

describe("vault.secrets.generate endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let vaultId: string;

  beforeAll(async () => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);

    await rpc.invoke<VaultCreateResponse>("vault.create", {
      sessionId: STUB_SESSION_ID,
      name: "store",
      user: "alice",
      hostname: "homelab",
    });
    vaultId = (await persistence.readVault("store")).id;
  });

  afterAll(() => persistence.teardown());

  it("should persist a secret when an explicit value is provided", async () => {
    /* @Given a persisted vault */
    /* @When the client requests a secret generation with an explicit value */
    await rpc.invoke<VaultSecretsGenerateResponse>("vault.secrets.generate", {
      sessionId: STUB_SESSION_ID,
      vaultId,
      name: "db-password",
      hostname: "homelab",
      user: "alice",
      value: "p4ss",
    });

    /* @Then the named secret is persisted in the vault */
    const vault = await persistence.readVault("store");
    const secret = vault.secrets.find((s) => s.name === "db-password");
    assertEquals(secret !== undefined, true);
  });

  it("should auto-generate a value when none is provided", async () => {
    /* @Given a persisted vault */
    /* @When the client requests a secret generation without providing a value */
    await rpc.invoke<VaultSecretsGenerateResponse>("vault.secrets.generate", {
      sessionId: STUB_SESSION_ID,
      vaultId,
      name: "api-token",
      hostname: "homelab",
      user: "alice",
      value: null,
    });

    /* @Then the named secret is persisted in the vault */
    const vault = await persistence.readVault("store");
    const secret = vault.secrets.find((s) => s.name === "api-token");
    assertEquals(secret !== undefined, true);
  });
});
