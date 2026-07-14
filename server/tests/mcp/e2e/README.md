# MCP e2e — live end-to-end tests

Live tests that spawn the real MCP server and drive it tool-by-tool against a real backend (the
`homelab`/`cp4` lab), one happy path per exposed endpoint. **Dev-only and opt-in** — run them with
the `mcp:e2e:*` tasks.

## Two kinds of MCP test

| File suffix                            | What it is                                       | Run by                |
| -------------------------------------- | ------------------------------------------------ | --------------------- |
| `server/tests/mcp/*.test.ts`           | unit/integration tests of the MCP port internals | `deno test` (CI)      |
| `server/tests/mcp/e2e/**/*.mcptest.ts` | a live e2e scenario through a real server        | `deno task mcp:e2e:*` |

The `.mcptest.ts` suffix keeps these out of the default `deno test` (it only matches `*.test.ts`),
since they need a live server + lab.

## Shape — just like every other test

Ordinary `describe/it` with gherkin block comments over plain client calls and `@std/assert` — no
DSL, no special report machinery.

```ts
import { describe, it } from "@std/testing/bdd";
import { assert } from "@std/assert";
import { mcp } from "../harness.ts";
import { SECRET, VAULT } from "../fixtures.ts";

describe("Vault management", () => {
  const client = mcp(); // beforeAll spawns the server; afterAll closes it

  it("creates a vault and a secret, then cleans up", async () => {
    /* @Given a created vault */
    const { vaultId } = await client().parsed<{ vaultId: string }>(
      "devstation_vault_create",
      VAULT,
    );

    /* @Then it appears in the list */
    const vaults = await client().parsed<{ id: string }[]>("devstation_vault_list", {});
    assert(vaults.some((v) => v.id === vaultId));

    /* @When a secret is generated */
    const { secretId } = await client().parsed<{ secretId: string }>(
      "devstation_vault_secret_generate",
      { vaultId, ...SECRET },
    );
    /* @Then it's removed cleanly */
    await client().parsed("devstation_vault_secret_delete", { vaultId, secretId });
    await client().parsed("devstation_vault_delete", { vaultId });
  });
});
```

## Layout

```
e2e/
  harness.ts      ← mcp(): spawns the server (beforeAll) + returns a client getter
  fixtures.ts     ← disposable test data as CONSTANTS (VAULT, SIZE, …) + uniqueName
  live.ts         ← resolveLive(): the real lab cluster + node, read from the catalog
  management/*.mcptest.ts   ← no-side-effect suite (catalog CRUD, live reads, resources)
  infra/*.mcptest.ts        ← side-effect suite (real node: plan/apply/destroy, image, ssh, install)
```

Fixtures are constants carrying the `ds-e2e-` policy prefix; merge runtime references inline
(`{ vaultId, ...SECRET }`). Endpoints with no pure happy path are `it.ignore("… (reason)")` (e.g.
`test_connection` needs a raw Proxmox token MCP never exposes).

## Running

```bash
export DEVSTATION_MCP_POLICY=prefix:ds-e2e-,allow:homelab   # opt-in safety
deno task mcp:e2e:management   # → reports/mcp/management.junit.xml
deno task mcp:e2e:infra        # real node; apply/destroy/install gated by DEVSTATION_E2E_DESTRUCTIVE=1
```

Auth: the spawned server self-loads its scoped token from `~/.devstation/mcp/token.json` (mint once
via `devstation` → /mcp); token scopes gate what runs. Reports: `deno test --junit-path` writes
JUnit to `reports/mcp/` (gitignored).
