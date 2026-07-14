# Reference: JSON-RPC Contract & Codegen

Use this when adding or changing any RPC method — it is the **first** step of a
slice. The UI and the server only share types *through* the generated contract,
so nothing connects until this is done.

## Source of truth

`libs/jsonrpc-schemas/<bc>.openrpc.json` — one [OpenRPC 1.2.6](https://spec.open-rpc.org/)
document per bounded context. Language-neutral, **zero runtime code**. Every
materialization (TS today; Go/Python later) reads from here.

- `info.version` — semver of *that BC's* RPC surface.
- `methods[]` — one entry per method.
- `components.schemas` — reusable type shapes (`Ack`, records shared by methods).

## Code references

- A full document: `libs/jsonrpc-schemas/image.openrpc.json`
- Generated output: `libs/jsonrpc-contracts-ts/src/image.gen.ts`
- The generator (and its supported subset): `libs/jsonrpc-contracts-ts/src/codegen.ts`
- Idempotency test: `libs/jsonrpc-contracts-ts/tests/codegen.test.ts`

## Method shape

```jsonc
{
  "name": "image.register",                       // "<bc>.<action>"
  "description": "Registers a new OS image in the catalog.",
  "params": [
    { "name": "sessionId", "required": true,
      "schema": { "title": "SessionIdentifier", "type": "string", "format": "uuid" } },
    { "name": "name", "required": true,
      "schema": { "title": "ImageName", "type": "string" } },
    { "name": "os", "required": true,
      "schema": { "title": "ImageOperatingSystem", "type": "string",
                  "enum": ["ubuntu-22-04", "ubuntu-24-04", "debian-12", "debian-13"] } }
  ],
  "result": { "name": "ack", "schema": { "$ref": "#/components/schemas/Ack" } },
  "errors": [ { "code": -32000, "message": "Unauthenticated." } ]
}
```

- **Protected methods carry `sessionId`** as the first param (`format: "uuid"`).
  Public methods (auth setup, session create) omit it.
- Give every `schema` a `title` — the generator uses it for JSDoc and named
  component types. Untitled schemas get synthetic names; avoid that.
- An empty/ack result references a shared `Ack` schema rather than inventing a
  per-method empty object.

## Codegen

```bash
deno task contracts:codegen      # reads every *.openrpc.json -> one <bc>.gen.ts each
```

- Each method `<bc>.<action>` generates a `<Bc><Action>Request` /
  `<Bc><Action>Response` pair (e.g. `ImageRegisterRequest`,
  `ImageRegisterResponse`), plus the BC's `components.schemas` as named types.
- Consumers import per BC: `import type { ImageRegisterRequest } from
  "@jsonrpc-contracts-ts/image.gen.ts"`. Short, local names; no cross-BC
  collisions (separate modules).
- **Commit the regenerated `*.gen.ts` in the same change.** CI re-runs codegen
  and fails if the output drifts (`tests/codegen.test.ts`). Never hand-edit a
  `.gen.ts`.

## Supported JSON Schema subset

`object`, `string`, `number`, `boolean`, `integer`, `array`; `$ref` to
`#/components/schemas/<Name>`; `required`, `enum`, `format` (kept as plain string
+ JSDoc). **Not** supported: `oneOf` / `allOf` / `anyOf`,
`patternProperties`, conditionals, recursive types. If you need one, extend
`codegen.ts` first (it documents the migration path) — don't smuggle unsupported
constructs into a schema.

## Rules

- **No runtime code** in `libs/jsonrpc-schemas/`. Only `.openrpc.json`.
- **One file per BC.** Don't merge contexts into one document.
- **Additive evolution only.** Removing or renaming a field is breaking — bump
  the BC's `info.version`.
- The schema is the contract: consumers depend on it, it depends on nothing.

## Where this plugs in next

The generated `<Bc><Action>Request`/`Response` types are consumed by the inbound
RPC endpoint ([hexagonal.md](hexagonal.md)) on the server side and by the UI
integration class ([ui.md](ui.md)) on the client side.
