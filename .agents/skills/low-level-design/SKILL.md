---
name: low-level-design
description: End-to-end playbook for a DevStation feature slice — OpenRPC contract + codegen, Ink UI (screen, form, integration, provider wiring), domain modeling (aggregates, entities, VOs, events, ports), commands/handlers, query read models, inbound RPC/MCP, outbound adapters, policies, composition root, and the tests for each layer. Use when creating or modifying any feature slice or its tests; read only the reference(s) matching the layers you touch.
metadata:
  category: engineering
  language: typescript
---

# Low-Level Design

The how-to for building a vertical slice through DevStation — UI to disk. It
assumes the invariants in the `code-standards` rule are already in force; this
skill shows the patterns and the closest code example to copy for each layer.

A feature spans **two processes joined by a contract**: the Ink UI and the
engine never share code — they share generated types produced from an OpenRPC
schema. So a slice is not "server work"; it runs contract → server → UI.

**Progressive disclosure.** Do not read every reference. Identify the layers your
change touches, open those references, and read the nearest example each points
to before writing code.

## Pick the reference for your activity

| Building / modifying | Read |
|---|---|
| An RPC method: OpenRPC schema + codegen (always first) | [contract.md](references/contract.md) |
| Ink screen, form, integration class, provider/menu wiring | [ui.md](references/ui.md) |
| Aggregates, entities, value objects, collections, exceptions, domain events, domain ports | [domain.md](references/domain.md) |
| Commands, handlers, factories, write-side application services | [command.md](references/command.md) |
| Read models under `application/queries/` | [query.md](references/query.md) |
| Inbound RPC/MCP, outbound persistence/executions, policies, registries, composition root | [hexagonal.md](references/hexagonal.md) |
| Unit, integration, architecture, UI, or MCP E2E tests | [tests.md](references/tests.md) |

## End-to-end slice checklist

A new capability typically touches every step below. Skip a step only when the
change genuinely doesn't reach that layer (e.g. a pure read needs no aggregate
behavior).

1. **Contract** — author/extend `libs/jsonrpc-schemas/<bc>.openrpc.json`, run
   `deno task contracts:codegen`, commit the regenerated `<bc>.gen.ts`
   ([contract.md](references/contract.md)).
2. **Domain** — model the behavior on the aggregate / VOs / events
   ([domain.md](references/domain.md)).
3. **Application** — command DTO + handler (+ factory if provider-specialized);
   a query model if it's read-side ([command.md](references/command.md),
   [query.md](references/query.md)).
4. **Outbound** — persistence and/or execution adapter behind a port
   ([hexagonal.md](references/hexagonal.md)).
5. **Inbound** — RPC + MCP endpoints; add to the per-BC `endpoints.ts`, the root
   `rpc.ts`/`mcp.ts`, and (for new MCP scopes) both scope catalogs
   ([hexagonal.md](references/hexagonal.md)).
6. **Compose** — wire handlers, adapters, endpoints, queries, and policies in
   `server/src/dependencies.ts` ([hexagonal.md](references/hexagonal.md)).
7. **UI** — integration class → provider hook → screen/form → navigation entry
   ([ui.md](references/ui.md)).
8. **Tests** — cover each touched layer in the same change set; keep
   architecture and codegen tests green ([tests.md](references/tests.md)).

Mirror the closest existing sibling exactly; do not invent new structures.
