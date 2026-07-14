# Skill: Tests

Use this skill when creating or modifying unit, integration, architecture, UI, or MCP E2E tests.

## Global Rules

- Use `describe/it/beforeAll/afterAll` from `@std/testing/bdd`.
- Do not write new `Deno.test + t.step` tests.
- Gherkin comments and test titles are in English.
- Gherkin comments use business language, not container/adapter infrastructure names.
- Prefer focused tests matching the changed slice; expand only when touching shared behavior.

## Unit Tests

Unit tests validate isolated domain/application behavior with no filesystem or provider I/O.

- Domain unit tests exercise aggregate/VO public behavior.
- Application unit tests may use fakes/stubs/test recorders for ports.
- Use explicit construction with VOs; do not create operation fixtures.
- Keep fixtures in `server/tests/<bc>/fixtures/` only when reused.

```ts
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

describe("Vault", () => {
  it("should create an empty vault", () => {
    /* @Given a valid vault name */
    const name = new Name("homelab");

    /* @When the vault is created */
    const vault = Vault.create(name, creation());

    /* @Then it starts without secrets */
    assertEquals(vault.secrets.length, 0);
  });
});
```

## Integration Tests

Integration tests validate complete flows with real adapters and real temp storage.

- No mocks in integration tests.
- Use the BC `testContainer()`/`Persistence` helper when one exists.
- Assert persisted records by reading storage directly, not by calling the system again through another path.
- Query integration tests instantiate/resolve the query directly.
- Endpoint integration tests call the endpoint, not the handler, when validating inbound glue.

## Architecture Tests

Architecture tests live in `server/tests/architecture/` and use `@arch-test-ts`.

- Add/update arch tests when changing layer boundaries, query layout, provider slices, MCP/RPC rules,
  or sanctioned exceptions.
- Prefer positive `toOnlyImport` rules.
- Every exception must be narrow and include a `reason`.

## UI Tests

- Use `ink-testing-library` for React Ink components.
- Always call `unmount()` at the end of each `it()`.
- Cover state transitions, empty/loading/error states, and input behavior when the component changed.

## MCP E2E Tests

There are two MCP test kinds:

| File suffix | Meaning | Runner |
|---|---|---|
| `server/tests/mcp/*.test.ts` | MCP port internals | `deno test` |
| `server/tests/mcp/e2e/**/*.mcptest.ts` | live E2E scenario through a real MCP server | `deno task mcp:e2e:*` |

Live e2e tests are ordinary `describe/it` tests that orchestrate a real MCP
client directly — same shape as every other test (gherkin block comments
over plain calls + `@std/assert`). The `.mcptest.ts` suffix keeps them out
of the default `deno test` (they need a live server + lab); run them on
demand with the tasks below.

- Add a file under `server/tests/mcp/e2e/<suite>/<scenario>.mcptest.ts`
  (folder = suite: `management` = no side effect, `infra` = real node).
- `const client = mcp();` from `../harness.ts` (spawns the server per
  `describe`); call `client().parsed/call/readResource(...)` directly.
- Use disposable fixture constants from `../fixtures.ts` (e.g. `VAULT`),
  merging runtime refs inline; resolve the live cluster via `resolveLive`
  from `../live.ts`. Never hardcode mutable lab resources.
- Endpoints with no pure happy path → `it.ignore("name (reason)", () => {})`.
- Destructive infra scenarios require policy allow/prefix and
  `DEVSTATION_E2E_DESTRUCTIVE=1`.
- Reports: `deno test --junit-path` writes JUnit to `reports/mcp/`.

Run examples:

```bash
deno task test                  # unit/integration/arch/UI — ignores *.mcptest.ts
deno task check
export DEVSTATION_MCP_POLICY=prefix:ds-e2e-,allow:homelab
deno task mcp:e2e:management     # live, no side effect
deno task mcp:e2e:infra          # live, real node (set DEVSTATION_E2E_DESTRUCTIVE=1 for apply/destroy)
```
