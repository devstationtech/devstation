/**
 * Vault management e2e — every vault MCP endpoint over a real server, one
 * happy path. Pure catalog (no infra), self-cleaning.
 *
 * Endpoints: vault_create, _list, _secret_generate, _secrets_list,
 *            _secret_remove, _remove.
 */
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";
import { SECRET, VAULT } from "../fixtures.ts";

describe("Vault management", () => {
  const client = mcp();

  it("creates a vault, manages a secret in it, and cleans up", async () => {
    /* @Given a created vault */
    const { vaultId } = await client().parsed<{ vaultId: string }>(
      "devstation_vault_create",
      VAULT,
    );

    /* @Then it appears in the vault list */
    const vaults = await client().parsed<{ id: string }[]>("devstation_vault_list", {});
    assert(vaults.some((v) => v.id === vaultId), "created vault should be listed");

    /* @When a secret is generated in the vault */
    const { secretId } = await client().parsed<{ secretId: string }>(
      "devstation_vault_secret_generate",
      { vaultId, ...SECRET },
    );

    /* @Then the secret is listed by metadata only — no value leaks */
    const secrets = await client().parsed<{ id: string; value?: unknown }[]>(
      "devstation_vault_secrets_list",
      { vaultId },
    );
    assert(secrets.some((s) => s.id === secretId), "generated secret should be listed");
    assert(secrets.every((s) => s.value == null), "secret values must not appear in the listing");

    /* @When the secret and the vault are removed */
    await client().parsed("devstation_vault_secret_delete", { vaultId, secretId });
    await client().parsed("devstation_vault_delete", { vaultId });

    /* @Then the vault is gone from the list */
    const remaining = await client().parsed<{ id: string }[]>("devstation_vault_list", {});
    assert(!remaining.some((v) => v.id === vaultId), "removed vault should be gone");
  });
});
