# @jsonrpc-contracts

TypeScript materialization of this project's JSON-RPC contracts. Contains the codegen'd
Request/Response types and the script that produces them. **No runtime facades** — those live in
each UI's `client/` folder.

## What's inside

| Module             | Purpose                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `contracts.gen.ts` | **Auto-generated.** Aggregated Request/Response types from every BC's OpenRPC document in `@jsonrpc-schemas/`. Do not edit. |
| `codegen.ts`       | Reads `@jsonrpc-schemas/*.openrpc.json` and emits `contracts.gen.ts`.                                                       |
| `mod.ts`           | Barrel — re-exports types.                                                                                                  |

## Distinction from sibling packages

| Concern                   | @jsonrpc-client                         | @jsonrpc-schemas                  | @jsonrpc-contracts                      |
| ------------------------- | --------------------------------------- | --------------------------------- | --------------------------------------- |
| Knowledge of this project | None                                    | Yes (the schemas)                 | Yes (TS materialization of the schemas) |
| Runtime code              | `Client`, `SubprocessCall`, `Exception` | None (just JSON)                  | Only the codegen script                 |
| Publishable to public npm | Yes (generic)                           | No (project-specific, vendorable) | No (TS-specific to this project)        |

## Why facades aren't here

The earlier version of this package exposed typed BC facades (`AuthClient`, etc.). They were moved
to `cli/ui/client/` because:

- A facade is **integration glue**, not a contract.
- Different UIs may want different ergonomics (sync wrappers, hooks, decorators, etc.).
- One TS UI today → premature to abstract.

When a second TS UI appears (Electron), revisit whether to promote `cli/ui/client/` to a shared
package.

## Codegen

```
deno task contracts:codegen
```

Walks `@jsonrpc-schemas/*.openrpc.json`, aggregates the catalogs and `components.schemas`, and
writes the result to `contracts.gen.ts`. The output is committed to git; CI verifies idempotency.

## Conventions

- **Imports allowed**: `@jsonrpc-schemas/*` at codegen time; nothing else.
- **Static types only** for `contracts.gen.ts` — no runtime code.
- **One file per BC's schemas** stays in `@jsonrpc-schemas/`; this package aggregates.
