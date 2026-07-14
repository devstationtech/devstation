# @jsonrpc-schemas

**Source of truth** for the DevStation Core RPC API. One `*.openrpc.json`
[OpenRPC 1.2.6](https://spec.open-rpc.org/) document per bounded context. Language-neutral; zero
runtime code. Every materialization (TypeScript today; Go/Python later) is generated from here.

- **No runtime code** in this package — only `.openrpc.json` files.
- **One file per BC**; **additive evolution only** (bump `info.version` on a breaking change).
- Codegen: `deno task contracts:codegen` → `libs/jsonrpc-contracts-ts/src/<bc>.gen.ts`.

The authoring + codegen workflow (method shape, supported JSON Schema subset, rules) is documented
as the single source of truth in the `low-level-design` skill:
[`.agents/skills/low-level-design/references/contract.md`](../../.agents/skills/low-level-design/references/contract.md).
