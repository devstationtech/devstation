# Architecture

## Layer Dependencies

Four layers. **Inner layers never import outer layers.**

```text
Domain        -> no imports from application, inbound, or outbound
Application   -> imports domain, own application, shared
Inbound       -> imports application and domain; never imports outbound
Outbound      -> imports domain and own outbound; sanctioned exceptions are declared in arch tests
```

Inbound and Outbound are siblings. They never communicate with each other directly.

## Query Layer

Queries live under `server/src/<bc>/application/queries/`. They are read model slices:

- read persisted records or provider APIs directly
- return plain JSON-friendly records
- do not import the BC's domain models or outbound ports
- may import only their own query slice and `server/src/shared/**`
- exception: `blueprint/application/queries` may traverse blueprint source because blueprint is a
  catalog/DSL BC, sanctioned by `server/tests/architecture/query.test.ts`

## Bounded Context Isolation

`server/src/shared/` is the only module that all bounded contexts may import freely.

No bounded context (`cluster`, `size`, etc.) may import from another bounded context's
`server/src/<bc>/` directory except through sanctioned exceptions declared in architecture tests.

**Sanctioned exceptions:**

- `inbound/policies/` may import `domain/events/` from another BC to translate foreign events into
  local commands. Never couple handlers cross-BC.
- `station/` has an explicit anti-corruption surface to consume `blueprint/`: restricted to
  `station/domain/contracts/blueprint.ts`, `station/domain/ports/outbound/blueprints.ts`,
  `station/outbound/blueprints/`, and `station/outbound/installer/`.
- `blueprint/application/queries/` may read the blueprint catalog source.
- Temporary bridge adapters in `shared/` must be explicit arch-test exceptions with a `reason`; move
  them into the owning BC when the boundary stabilizes.

## Internal BC Structure

Typical server BC layout:

```text
server/src/<bc>/
  domain/
    models/          # VOs, entities, aggregate root
    exceptions/      # domain exceptions when business rules can fail
    events/          # domain events when the BC emits events
    ports/
      outbound/      # interfaces needed by the domain/application
      inbound/       # optional marker/contracts created on demand
  application/
    commands/        # command DTOs with primitive input
    handlers/        # translate command -> VOs/entities -> aggregate calls
    factories/       # optional; use for provider-specialized model construction
    services/        # optional orchestration that does not fit in an aggregate
    queries/         # read models isolated from write-side
  inbound/
    rpc/             # JSON-RPC endpoints per BC
    mcp/             # MCP endpoints per BC; direct handler/query dispatch
    policies/        # reactions to cross-context events
  outbound/
    persistence/     # persistence adapter
    executions/      # provider/process adapters when needed
```

### Exception: `blueprint/`

`blueprint/` is a catalog/DSL BC, not a persistent hexagonal BC. It exposes contracts for blueprint
authors and parser/runtime code. Do not force full hexagonal structure onto it.

### `domain/events/`

If a BC emits events consumed by the in-process bus, concrete event classes live in
`server/src/<bc>/domain/events/`. Shared event primitives live in
`server/src/shared/building-blocks/domain/events/`.

## Runtime Isolation (`Deno.*`)

Host-runtime access is confined behind platform facades so the runtime stays
swappable. Both rules are enforced by content architecture tests:

- **Server** — `Deno.*` is allowed only in an explicit allowlist: outbound
  adapters, `shared/platform/`, the transport servers
  (`shared/inbound/{rpc,mcp}/server.ts`), `env.ts`, and the composition/entry
  files (`dependencies.ts`, `rpc.ts`, `mcp.ts`). Domain, application, and
  endpoint code never touches `Deno.*` — inject `FileSystem`/platform ports
  instead. Enforced by `server/tests/architecture/runtime-isolation.test.ts`.
- **TUI** — `tui/ink/src/shared/platform/deno-runtime.ts` is the **only** file
  that may touch `Deno.*`; everything else goes through the `Runtime` facade.
  Enforced by `tui/ink/tests/architecture/deno-isolation.test.ts`.

## Diagram

`.agents/architecture/hexagonal-diagram.md` maps the ports-&-adapters SVG to
the code, adapter by adapter — use it to orient before touching a boundary.

## Import Map Aliases

| Alias | Resolves to | Use in |
|---|---|---|
| `@server/` | `server/src/` | Server source imports |
| `@tests/` | `server/tests/` | Test fixtures and suites (e.g. `@tests/shared/fixtures/...`) |
| `@ui/` | `tui/ink/src/` | Ink UI source imports |
