import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { CreateVaultHandler } from "@server/vault/application/handlers/create-vault-handler.ts";
import { DeleteVaultHandler } from "@server/vault/application/handlers/delete-vault-handler.ts";
import { CreateVault } from "@server/vault/application/commands/create-vault.ts";
import { DeleteVault } from "@server/vault/application/commands/delete-vault.ts";
import { VaultAlreadyExists } from "@server/vault/domain/exceptions/vault-already-exists.ts";
import { Vault } from "@server/vault/domain/models/vault.ts";
import type { Id } from "@server/vault/domain/models/id.ts";
import { Name } from "@server/vault/domain/models/name.ts";
import type { Vaults } from "@server/vault/domain/ports/outbound/vaults.ts";

/**
 * CreateVault + DeleteVault are the simple ends of the vault BC.
 * Handler unit tests pin the contracts so a future change in the
 * Vaults port surface (e.g. adding a "soft delete") still respects
 * the create-uniqueness + remove-by-id contract.
 */

function inMemoryVaults(initial: Vault[] = []): {
  vaults: Vaults;
  saved: Vault[];
  deleted: string[];
} {
  const saved = [...initial];
  const deleted: string[] = [];
  return {
    saved,
    deleted,
    vaults: {
      of: (id: Id) => {
        const match = saved.find((v) => v.id.value === id.value);
        if (!match) throw new Error(`vault not found: ${id.value}`);
        return Promise.resolve(match);
      },
      byName: (name: Name) =>
        Promise.resolve(saved.find((v) => v.name.value === name.value) ?? null),
      save: (vault: Vault) => {
        saved.push(vault);
        return Promise.resolve();
      },
      exists: (name: Name) => Promise.resolve(saved.some((v) => v.name.value === name.value)),
      remove: (id: Id) => {
        deleted.push(id.value);
        return Promise.resolve();
      },
    },
  };
}

describe("CreateVaultHandler", () => {
  it("creates and persists a fresh vault when the name is free", async () => {
    /* @Given an empty store */
    const { vaults, saved } = inMemoryVaults();
    const handler = new CreateVaultHandler(vaults);
    /* @When a vault with a unique name is created */
    await handler.handle(new CreateVault("homelab-secrets", "alice", "workstation"));
    /* @Then the vault was persisted with the operator's name/creator/host */
    assertEquals(saved.length, 1);
    assertEquals(saved[0].name.value, "homelab-secrets");
    assertEquals(saved[0].creation.by.value, "alice");
    assertEquals(saved[0].creation.hostname.value, "workstation");
  });

  it("rejects creating a vault with a name that already exists (uniqueness)", async () => {
    /* @Given the store already contains a 'homelab-secrets' vault */
    const existing = Vault.create(
      new Name("homelab-secrets"),
      // creation isn't asserted in this case — just need the name
      // deno-lint-ignore no-explicit-any
      { by: { value: "x" }, hostname: { value: "h" }, at: { date: new Date() } } as any,
    );
    const { vaults, saved } = inMemoryVaults([existing]);
    const handler = new CreateVaultHandler(vaults);
    /* @When a second create with the same name is attempted */
    /* @Then VaultAlreadyExists is raised AND no second entry is persisted */
    await assertRejects(
      () => handler.handle(new CreateVault("homelab-secrets", "alice", "workstation")),
      VaultAlreadyExists,
    );
    assertEquals(saved.length, 1);
  });

  it("rejects an invalid name (domain VO validation propagates)", async () => {
    /* @Given any store + a name that fails the Slug validation (uppercase) */
    const { vaults } = inMemoryVaults();
    const handler = new CreateVaultHandler(vaults);
    /* @When create runs */
    /* @Then it throws — the Name VO rejects 'BadName' before reaching exists() */
    await assertRejects(
      () => handler.handle(new CreateVault("BadName", "alice", "workstation")),
      Error,
    );
  });
});

describe("DeleteVaultHandler", () => {
  it("delegates to Vaults.delete with the parsed id", async () => {
    /* @Given a vault store */
    const { vaults, deleted } = inMemoryVaults();
    const handler = new DeleteVaultHandler(vaults);
    /* @When remove is invoked */
    await handler.handle(new DeleteVault("00000000-0000-0000-0000-000000000001"));
    /* @Then Vaults.delete was called once with the id */
    assertEquals(deleted, ["00000000-0000-0000-0000-000000000001"]);
  });
});
