import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { CreateVaultMcpEndpoint } from "@server/vault/inbound/mcp/create-vault/endpoint.ts";
import { DeleteVaultMcpEndpoint } from "@server/vault/inbound/mcp/delete-vault/endpoint.ts";
import { ListVaultsMcpEndpoint } from "@server/vault/inbound/mcp/list-vaults/endpoint.ts";
import { GenerateSecretMcpEndpoint } from "@server/vault/inbound/mcp/generate-secret/endpoint.ts";
import { DeleteSecretMcpEndpoint } from "@server/vault/inbound/mcp/delete-secret/endpoint.ts";
import { ListSecretsMcpEndpoint } from "@server/vault/inbound/mcp/list-secrets/endpoint.ts";
import type { CreateVaultHandler } from "@server/vault/application/handlers/create-vault-handler.ts";
import type { DeleteVaultHandler } from "@server/vault/application/handlers/delete-vault-handler.ts";
import type { Query as AllVaultsQuery } from "@server/vault/application/queries/all/query.ts";
import type { GenerateSecretHandler } from "@server/vault/application/handlers/generate-secret-handler.ts";
import type { DeleteSecretHandler } from "@server/vault/application/handlers/delete-secret-handler.ts";
import type { Query as AllSecretsQuery } from "@server/vault/application/queries/secrets/all/query.ts";
import type { CreateVault } from "@server/vault/application/commands/create-vault.ts";
import type { DeleteVault } from "@server/vault/application/commands/delete-vault.ts";
import type { GenerateSecret } from "@server/vault/application/commands/generate-secret.ts";
import type { DeleteSecret } from "@server/vault/application/commands/delete-secret.ts";
import type { SessionResolver } from "@server/shared/authentication/domain/ports/outbound/session-resolver.ts";

/**
 * Pins the wire metadata and dispatch glue for all six vault MCP
 * endpoints. Each test follows the same three-shape pattern as
 * cluster-mcp-endpoints.test.ts:
 *
 *  1. Wire metadata (name + risk + schema type).
 *  2. Dispatch builds the correct Command and returns the right value.
 *
 * No policy calls: vault/size/blueprint BCs have no MCP policy
 * guard.
 */

// deno-lint-ignore no-explicit-any
type Anyish = any;

function fakeCreateVaultHandler(): { handler: CreateVaultHandler; calls: CreateVault[] } {
  const calls: CreateVault[] = [];
  const handler = {
    handle(cmd: CreateVault): Promise<{ vaultId: string }> {
      calls.push(cmd);
      return Promise.resolve({ vaultId: "vlt-fake-1" });
    },
  } as Anyish as CreateVaultHandler;
  return { handler, calls };
}

function fakeDeleteVaultHandler(): { handler: DeleteVaultHandler; calls: DeleteVault[] } {
  const calls: DeleteVault[] = [];
  const handler = {
    handle(cmd: DeleteVault): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as DeleteVaultHandler;
  return { handler, calls };
}

function fakeAllVaultsQuery(records: unknown[]): AllVaultsQuery {
  return { execute: () => Promise.resolve(records) } as Anyish;
}

function fakeGenerateSecretHandler(): {
  handler: GenerateSecretHandler;
  calls: GenerateSecret[];
} {
  const calls: GenerateSecret[] = [];
  const handler = {
    handle(cmd: GenerateSecret): Promise<{ secretId: string }> {
      calls.push(cmd);
      return Promise.resolve({ secretId: "sec-fake-1" });
    },
  } as Anyish as GenerateSecretHandler;
  return { handler, calls };
}

function fakeDeleteSecretHandler(): { handler: DeleteSecretHandler; calls: DeleteSecret[] } {
  const calls: DeleteSecret[] = [];
  const handler = {
    handle(cmd: DeleteSecret): Promise<void> {
      calls.push(cmd);
      return Promise.resolve();
    },
  } as Anyish as DeleteSecretHandler;
  return { handler, calls };
}

function fakeAllSecretsQuery(records: unknown[]): AllSecretsQuery {
  return { execute: (_vaultId: string) => Promise.resolve(records) } as Anyish;
}

function fakeSessionResolver(key: string): SessionResolver {
  return { resolve: () => key };
}

// ─── CreateVaultMcpEndpoint ───────────────────────────────────────────────────

describe("CreateVaultMcpEndpoint", () => {
  it("declares mutating wire metadata", () => {
    /* @Given */
    const { handler } = fakeCreateVaultHandler();
    const endpoint = new CreateVaultMcpEndpoint(handler);
    /* @Then */
    assertEquals(endpoint.name, "devstation_vault_create");
    assertEquals(endpoint.risk, "mutating");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("builds CreateVault with all args and echoes the new vault id", async () => {
    /* @Given */
    const { handler, calls } = fakeCreateVaultHandler();
    const endpoint = new CreateVaultMcpEndpoint(handler);

    /* @When */
    const result = await endpoint.dispatch({ name: "my-vault", user: "alice", hostname: "box1" });

    /* @Then */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].name, "my-vault");
    assertEquals(calls[0].user, "alice");
    assertEquals(calls[0].hostname, "box1");
    // The id is echoed back so the caller can proceed to
    // vault.secret.generate without an extra vault.list lookup.
    assertEquals(result, { vaultId: "vlt-fake-1", name: "my-vault" });
  });
});

// ─── DeleteVaultMcpEndpoint ───────────────────────────────────────────────────

describe("DeleteVaultMcpEndpoint", () => {
  it("declares destructive wire metadata", () => {
    /* @Given */
    const { handler } = fakeDeleteVaultHandler();
    const endpoint = new DeleteVaultMcpEndpoint(handler);
    /* @Then */
    assertEquals(endpoint.name, "devstation_vault_delete");
    assertEquals(endpoint.risk, "destructive");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("builds DeleteVault with vaultId and returns {}", async () => {
    /* @Given */
    const { handler, calls } = fakeDeleteVaultHandler();
    const endpoint = new DeleteVaultMcpEndpoint(handler);

    /* @When */
    const result = await endpoint.dispatch({ vaultId: "v-abc" });

    /* @Then */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].id, "v-abc");
    assertEquals(result, {});
  });
});

// ─── ListVaultsMcpEndpoint ────────────────────────────────────────────────────

describe("ListVaultsMcpEndpoint", () => {
  it("declares read wire metadata", () => {
    /* @Given */
    const endpoint = new ListVaultsMcpEndpoint(fakeAllVaultsQuery([]));
    /* @Then */
    assertEquals(endpoint.name, "devstation_vault_list");
    assertEquals(endpoint.risk, "read");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("returns the records the AllVaultsQuery yields", async () => {
    /* @Given */
    const records = [{ id: "v1", name: "homelab", version: 1 }];
    const endpoint = new ListVaultsMcpEndpoint(fakeAllVaultsQuery(records));

    /* @When */
    const result = await endpoint.dispatch();

    /* @Then */
    assertEquals(result, records);
  });
});

// ─── GenerateSecretMcpEndpoint ────────────────────────────────────────────────

describe("GenerateSecretMcpEndpoint", () => {
  it("declares mutating wire metadata", () => {
    /* @Given */
    const { handler } = fakeGenerateSecretHandler();
    const endpoint = new GenerateSecretMcpEndpoint(handler, fakeSessionResolver("K"));
    /* @Then */
    assertEquals(endpoint.name, "devstation_vault_secret_generate");
    assertEquals(endpoint.risk, "mutating");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("uses session key and passes all args to GenerateSecret", async () => {
    /* @Given */
    const { handler, calls } = fakeGenerateSecretHandler();
    const endpoint = new GenerateSecretMcpEndpoint(handler, fakeSessionResolver("secret-key"));

    /* @When */
    const result = await endpoint.dispatch({
      vaultId: "v1",
      name: "db-password",
      hostname: "server01",
      user: "alice",
      value: "hunter2",
      description: "DB root password",
    });

    /* @Then */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].vaultId, "v1");
    assertEquals(calls[0].name, "db-password");
    assertEquals(calls[0].key, "secret-key");
    assertEquals(calls[0].hostname, "server01");
    assertEquals(calls[0].user, "alice");
    assertEquals(calls[0].value, "hunter2");
    assertEquals(calls[0].description, "DB root password");
    // The id is echoed back so the caller can chain into a use of
    // the new secret without a vault.secrets.list round-trip.
    assertEquals(result, {
      secretId: "sec-fake-1",
      name: "db-password",
      vaultId: "v1",
    });
  });

  it("passes null for optional value and description when omitted", async () => {
    /* @Given */
    const { handler, calls } = fakeGenerateSecretHandler();
    const endpoint = new GenerateSecretMcpEndpoint(handler, fakeSessionResolver("K"));

    /* @When */
    await endpoint.dispatch({ vaultId: "v1", name: "token", hostname: "h", user: "u" });

    /* @Then */
    assertEquals(calls[0].value, null);
    assertEquals(calls[0].description, null);
  });
});

// ─── DeleteSecretMcpEndpoint ──────────────────────────────────────────────────

describe("DeleteSecretMcpEndpoint", () => {
  it("declares destructive wire metadata", () => {
    /* @Given */
    const { handler } = fakeDeleteSecretHandler();
    const endpoint = new DeleteSecretMcpEndpoint(handler);
    /* @Then */
    assertEquals(endpoint.name, "devstation_vault_secret_delete");
    assertEquals(endpoint.risk, "destructive");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("builds DeleteSecret with vaultId + secretId and returns {}", async () => {
    /* @Given */
    const { handler, calls } = fakeDeleteSecretHandler();
    const endpoint = new DeleteSecretMcpEndpoint(handler);

    /* @When */
    const result = await endpoint.dispatch({ vaultId: "v1", secretId: "s1" });

    /* @Then */
    assertEquals(calls.length, 1);
    assertEquals(calls[0].vaultId, "v1");
    assertEquals(calls[0].secretId, "s1");
    assertEquals(result, {});
  });
});

// ─── ListSecretsMcpEndpoint ───────────────────────────────────────────────────

describe("ListSecretsMcpEndpoint", () => {
  it("declares read wire metadata", () => {
    /* @Given */
    const endpoint = new ListSecretsMcpEndpoint(fakeAllSecretsQuery([]));
    /* @Then */
    assertEquals(endpoint.name, "devstation_vault_secrets_list");
    assertEquals(endpoint.risk, "read");
    assertEquals(endpoint.inputSchema.type, "object");
  });

  it("passes vaultId to AllSecretsQuery and returns the records", async () => {
    /* @Given */
    const records = [{ id: "s1", name: "db-pass", description: null }];
    const endpoint = new ListSecretsMcpEndpoint(fakeAllSecretsQuery(records));

    /* @When */
    const result = await endpoint.dispatch({ vaultId: "v1" });

    /* @Then */
    assertEquals(result, records);
  });
});
