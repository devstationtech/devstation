# integrations/

The local SDK this UI uses to talk to the engine over JSON-RPC. **One class per RPC surface**
(`<bc>-integration.ts`), React-agnostic — no hooks, no Ink, no DOM. React wiring lives in
`tui/ink/src/rpc-clients-provider.tsx`, which constructs the integrations once per session and
exposes them via context hooks (`useImage()`, …).

Each integration may import only `@jsonrpc-client-ts/` (the `Client` type) and the BC's
`@jsonrpc-contracts-ts/<bc>.gen.ts`. It must **not** import React/Ink or `@server/*`.

The how-to for building a UI feature end to end (integration → provider → screen → form →
navigation) is the single source of truth in the `low-level-design` skill:
[`.agents/skills/low-level-design/references/ui.md`](../../../../../.agents/skills/low-level-design/references/ui.md).
