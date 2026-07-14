import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Client } from "@jsonrpc-client-ts/client.ts";
import type {
  VaultCreateResponse,
  VaultSecretsGenerateResponse,
  VaultSecretsRetrieveResponse,
} from "@jsonrpc-contracts-ts/vault.gen.ts";
import { buildClient, STUB_SESSION_ID, testContainer } from "@tests/vault/fixtures/bootstrap.ts";
import { Persistence } from "@tests/vault/integration/outbound/persistence.ts";

describe("vault.secrets.retrieve endpoint — integration", () => {
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

  it("should return the plaintext value of a stored secret", async () => {
    /* @Given a persisted secret with a known value */
    await rpc.invoke<VaultSecretsGenerateResponse>("vault.secrets.generate", {
      sessionId: STUB_SESSION_ID,
      vaultId,
      name: "db-password",
      hostname: "homelab",
      user: "alice",
      value: "super-secret-value",
    });
    const stored = await persistence.readVault("secrets");
    const secret = stored.secrets.find((s) => s.name === "db-password")!;

    /* @When the client requests the secret value with vault and secret ids */
    const response = await rpc.invoke<VaultSecretsRetrieveResponse>(
      "vault.secrets.retrieve",
      { sessionId: STUB_SESSION_ID, vaultId, secretId: secret.id },
    );

    /* @Then the decrypted value is returned to the client */
    assertEquals(response.value, "super-secret-value");
  });

  it("should return null when the secret id is unknown", async () => {
    /* @Given a nonexistent secret identifier */
    /* @When the client requests the value */
    const response = await rpc.invoke<VaultSecretsRetrieveResponse>(
      "vault.secrets.retrieve",
      {
        sessionId: STUB_SESSION_ID,
        vaultId,
        secretId: "00000000-0000-0000-0000-000000000000",
      },
    );

    /* @Then the response carries a null value */
    assertEquals(response.value, null);
  });
});
