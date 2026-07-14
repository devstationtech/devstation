# Skill: Hexagonal Boundaries

Use this skill when creating or modifying inbound RPC/MCP/UI, outbound adapters, persistence,
executions, policies, ports, or the composition root.

## Code References

- RPC endpoint: `server/src/cluster/inbound/rpc/proxmox/nodes/register/endpoint.ts`
- MCP endpoint: `server/src/cluster/inbound/mcp/proxmox/nodes/register/endpoint.ts`
- MCP protocol shape: `server/src/shared/inbound/mcp/endpoint/endpoint.ts`
- Persistence adapter: `server/src/cluster/outbound/persistence/file-system/adapter.ts`
- Architecture tests: `server/tests/architecture/*.test.ts`
- Composition root: `server/src/dependencies.ts`

## Layer Rules

```text
Domain      -> own domain + shared only
Application -> own domain/application + shared
Inbound     -> own application/domain/inbound + shared; never outbound
Outbound    -> own domain/outbound + shared; sanctioned exceptions only via arch tests
```

Inbound and outbound are siblings. They communicate through commands, handlers, ports, and the
composition root, never by direct imports.

## Inbound RPC

- One endpoint class per RPC method.
- Endpoint imports generated JSON-RPC contract types, builds a command, and calls the handler/query.
- Endpoint returns wire response shape only; no domain objects leave the endpoint.
- No `Action`/`Request` classes for new server code.

```ts
export class RegisterNodeEndpoint implements ProtectedEndpoint<Method, Request, Response> {
  readonly method = "cluster.proxmox.nodes.register" as const;

  constructor(private readonly handler: RegisterNodeHandler) {}

  async dispatch(request: Request): Promise<Response> {
    await this.handler.handle(new RegisterNode(/* primitives */));
    return {};
  }
}
```

## Inbound MCP

- MCP endpoints live under `server/src/<bc>/inbound/mcp/**`.
- Shared MCP code under `server/src/shared/inbound/mcp/**` is protocol-level only and must not import
  BC application/domain code.
- BC MCP endpoints call application handlers/queries directly. Do not call JSON-RPC as a gateway.
- Always declare `name` (`devstation_<bc>_<action>`), `title`, `description`,
  `risk` (`read` | `mutating` | `destructive`), and `inputSchema`.
- Resolve the actor from args with `resolveActor(args)` (user/hostname optional,
  default to the engine host) rather than requiring them in the schema.
- Mutating/destructive MCP endpoints enforce policy using resolved resource
  identity when needed, and are registered with a scope in `mcp.ts`
  (`.protected(container.get(Endpoint), "vault:write")`). **Reuse the
  context's existing `<context>:read`/`<context>:write` scope**; only a
  genuinely new scope touches the scope catalogs (see Registries below).

## Outbound Persistence

- Adapter implements an outbound port and is the only layer that knows serialized storage shape.
- Adapter receives `FileSystem` via DI.
- Use `readObjectsOf`/`writeObjectsOf` helpers; do not duplicate filesystem parsing logic.
- Reconstruct aggregates via public constructors with VOs and optional `Version`.
- Keep `serialize`/`unserialize` private.
- Do not expose list methods for UI. UI/read-side uses queries.
- Serialized update methods (`update(id, change)`) protect against lost updates; long work must run
  between update calls, not inside the critical section.

## Outbound Execution/Provider Adapters

- Provider APIs and CLIs live in outbound or query provider slices depending on purpose.
- Write-side provider work (provisioning, image creation, SSH/bootstrap) belongs to outbound adapters
  behind domain/application ports.
- Read-side provider enrichment belongs to `application/queries/<provider>/api/**`, internal to the
  query slice.
- Do not create fake cross-provider abstractions before a second real provider or an unavoidable
  extension point.

## Policies

- Cross-context reactions live in `server/src/<consumer>/inbound/policies/`.
- Policies may import foreign domain events and own commands/handlers.
- Policies never import foreign domain models, handlers, or outbound ports.

## Registries & Wiring

An endpoint class is dead until it is exported, registered, and composed. Three
layers of registry sit above the endpoint:

- **Per-BC catalog** — `server/src/<bc>/inbound/rpc/endpoints.ts` and
  `server/src/<bc>/inbound/mcp/endpoints.ts` re-export every endpoint class in
  that BC. Add the new export here.
- **Root registry** — `server/src/rpc.ts` imports from each BC's `endpoints.ts`
  and calls `.protected(container.get(Endpoint))` (or `.public(...)` for
  session-less methods). `server/src/mcp.ts` does the same for MCP endpoints and
  resources.
- **Scope catalog (MCP only)** — a **new** MCP scope must be added in **both**
  `server/src/shared/inbound/mcp/scope/catalog.ts` (engine) and
  `tui/ink/src/mcp/scope-catalog.ts` (the token-generation UI).
  `server/tests/mcp/scope-catalog.test.ts` pins the engine catalog and
  cross-checks the TUI menu against it, so a one-sided edit fails the suite.
  Scope contexts are coarse PAT-style groups, not 1:1 with BCs (`executions`
  is a cross-BC surface with no `server/src/executions/` directory).

## Composition Root

`server/src/dependencies.ts` is the only place that wires across layers. For a
**new endpoint on an existing BC**, register its handler/query and the endpoint
itself. For a **new bounded context**, the checklist is:

1. Outbound adapter(s) (persistence, executions) bound to their ports.
2. Application handlers and query classes.
3. Inbound RPC + MCP endpoint classes.
4. Any `inbound/policies/` reacting to foreign events, plus the event→policy
   subscription on the bus.
5. The new BC's exports added to `rpc.ts` / `mcp.ts` (and scopes, per above).

Ordinary source files never reach across layers — only the composition root does.

## Architecture Tests

- Boundary changes require matching tests in `server/tests/architecture/`.
- Prefer positive `toOnlyImport` rules.
- Every exception must include a `reason` and should be narrower than the problem being solved.
