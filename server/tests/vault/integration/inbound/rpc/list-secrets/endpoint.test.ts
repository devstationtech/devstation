import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  VaultCreateResponse,
  VaultSecretsGenerateResponse,
  VaultSecretsListResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/vault/fixtures/bootstrap.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

describe("vault.secrets.list endpoint — integration", () => {
  let rpc: Client;
  let persistence: Persistence;
  let vaultId: string;

  beforeAll(async () => {
    const c = testContainer();
    persistence = c.get(Persistence);
    rpc = buildClient(c);

    await rpc.invoke<VaultCreateResponse>("vault.create", {
      sessionId: STUB_SESSION_ID,
      name: "secrets",
      user: "alice",
      hostname: "homelab",
    });
    vaultId = (await persistence.readVault("secrets")).id;
  });

  afterAll(() => persistence.teardown());

  it("should return an empty list when the vault has no secrets", async () => {
    /* @Given a persisted vault with no secrets */
    /* @When the client requests the secret listing */
    const response = await rpc.invoke<VaultSecretsListResponse>("vault.secrets.list", {
      sessionId: STUB_SESSION_ID,
      vaultId,
    });

    /* @Then the response carries an empty list */
    assertEquals(response, []);
  });

  it("should return secret metadata without plaintext values", async () => {
    /* @Given secrets are persisted in the vault */
    await rpc.invoke<VaultSecretsGenerateResponse>("vault.secrets.generate", {
      sessionId: STUB_SESSION_ID,
      vaultId,
      name: "db-password",
      hostname: "homelab",
      user: "alice",
      value: "p4ss",
      description: "database credential",
    });
    await rpc.invoke<VaultSecretsGenerateResponse>("vault.secrets.generate", {
      sessionId: STUB_SESSION_ID,
      vaultId,
      name: "api-token",
      hostname: "homelab",
      user: "alice",
      value: "t0k3n",
      description: null,
    });

    /* @When the client requests the secret listing */
    const response = await rpc.invoke<VaultSecretsListResponse>("vault.secrets.list", {
      sessionId: STUB_SESSION_ID,
      vaultId,
    });

    /* @Then the response carries the metadata of each secret */
    const names = response.map((s) => s.name).sort();
    assertEquals(names, ["api-token", "db-password"]);
    const dbPassword = response.find((s) => s.name === "db-password")!;
    assertEquals(dbPassword.description, "database credential");
    assertEquals(dbPassword.createdBy, "alice");
    /* @And no plaintext values are returned */
    assertEquals("value" in dbPassword, false);
  });
});
