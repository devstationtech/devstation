---
name: code-standards
description: The non-negotiable invariants for the DevStation CLI — stack, hexagonal + tactical-DDD + CQRS layering, bounded-context isolation, object-oriented conventions, file/class/method naming, import-map aliases, error handling, domain events, React Ink view rules, and test conventions. These are fixed structures that hold for every activity. Always load and apply when writing, refactoring, or reviewing any code in this repository.
metadata:
  category: engineering
  language: typescript
---

# DevStation Code Standards

Project invariants. They are non-negotiable and apply to **every** change. This
file is the entry point: it carries the always-true rules inline and links to a
reference per topic for the exhaustive tables you reach for during a specific
activity.

## Stack

- **Deno + TypeScript** monorepo, three workspace members: `/` (root),
  `server/` (engine), `tui/ink/` (Ink UI).
- **Cliffy** — CLI entry point. **React Ink** — terminal views.
- **DDD tactical patterns + hexagonal architecture + CQRS** (single-store, no event sourcing) in the engine.
- Gate before "done": `deno fmt --check`, `deno task lint`, `deno task check`,
  `deno task test` (same order as CI).

## Precedence

When sources conflict, follow this order:

1. Current code and architecture tests in `server/tests/architecture/`
2. Rules (this file and its references)
3. Skills (`low-level-design`)

## Layer dependencies (the core invariant)

Four layers. **Inner layers never import outer layers.**

```text
Domain        -> own domain + shared only
Application   -> own domain/application + shared
Inbound       -> own application/domain/inbound + shared; never imports outbound
Outbound      -> own domain/outbound + shared; sanctioned exceptions in arch tests
```

Inbound and Outbound are siblings; they communicate through commands, handlers,
ports, and the composition root — never by direct imports.

**CQRS** (single-store, no event sourcing). Writes flow inbound endpoint →
command → handler → aggregate → outbound adapter. Reads flow through
`application/queries/`, which bypass aggregates and write ports, read
records/provider APIs directly, and return plain JSON-friendly records.

## Bounded-context isolation

`server/src/shared/` is the only module every BC may import freely. No BC
(`cluster`, `size`, `images`, `station`, `vault`, `blueprint`, `auth`) imports
another BC's `server/src/<bc>/` except through sanctioned arch-test exceptions
(policies reacting to foreign events; the station→blueprint anti-corruption
surface; the blueprint catalog read). See `references/architecture.md`.

## Object-oriented conventions

- Classes/interfaces are the default unit in domain, application, inbound, and
  outbound use-case code. No standalone functions there (parser combinators,
  protocol helpers, colocated pure converters, and test helpers excepted).
- Use the TypeScript `private` modifier, never `#`. Prefer `readonly`.
  Constructors are public by default; omit the `public` keyword.
- Do not use `public` explicitly; omit `async` when a method just returns a
  `Promise` without `await`; prefer `const`; let TypeScript infer; use
  `import type` for type-only imports.

## Files

- One exported production class/interface/enum/type per file by default.
- Exceptions: cohesive record/type groups, generated contracts, and private
  helper types beside the export they support. Never merge unrelated classes to
  cut file count; never split helpers before reuse or size justifies it.

## Naming (principles; full tables in `references/naming.md`)

- Files: **lowercase-kebab-case**. Classes: **PascalCase**, context-free within
  their own module (`Id`, not `ClusterId`) unless provider/wire clarity needs a
  prefix. Methods: `camelCase`.
- Port methods use domain vocabulary (`of`, `byName`, `exists`, `add`, `update`,
  `remove`). Do **not** add `list()`/`all()` to outbound ports for UI reads —
  read-side uses queries.
- Use-case verbs are fixed domain language: `register`/`unregister` declare,
  `create`/`delete` materialize, `generate` derives (see `references/language.md`).
- Do not create `domain/operations/` files (see `references/ddd-contracts.md`).

## Import-map aliases

| Alias | Resolves to | Use in |
|---|---|---|
| `@server/` | `server/src/` | Server source imports |
| `@tests/` | `server/tests/` | Test fixtures and suites |
| `@ui/` | `tui/ink/src/` | Ink UI source imports |

## Error handling

- No `try/catch` without a meaningful recovery or contract to fulfill. Let
  runtime errors propagate; never silence with empty `catch`.
- Read models/adapters may treat first-run empty storage as empty via the
  `FileSystem` helpers. Provider enrichment may degrade gracefully **only** when
  that is the endpoint contract — and must log enough context to diagnose it.
- Avoid fallbacks/defaults that hide real configuration errors.

## General

- No over-engineering. No abstraction, helper, or layer before a second real use
  case. Do not create files unless strictly necessary.

## References — read the one matching your activity

| Reference | Read when you are touching |
|---|---|
| [architecture.md](references/architecture.md) | Layer boundaries, BC internal structure, query layer, sanctioned cross-BC exceptions |
| [ddd-contracts.md](references/ddd-contracts.md) | Aggregates/entities/VOs, the no-`operations` rule, cross-context VOs, factories |
| [naming.md](references/naming.md) | Exact file/class/method/directory names |
| [language.md](references/language.md) | Ubiquitous-language verbs (register vs create vs generate) and reserved terminology (provisioning, blueprint vs service) |
| [events.md](references/events.md) | Domain events and cross-context policies |
| [react-ink.md](references/react-ink.md) | Ink views, `useInput`, navigation props |
| [tests.md](references/tests.md) | Test conventions: coverage, no-mocks, Gherkin, `describe/it` |
