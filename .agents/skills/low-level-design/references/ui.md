# Reference: Ink UI Feature

Use this when building or changing a terminal feature. The UI talks to the engine
**only** over JSON-RPC — never imports `@server/*`. This reference is the how-to;
the **invariants** (multiple `useInput` with `isActive`, navigation props, where
sub-components live) are in the `code-standards` rule's `react-ink.md` and are
always in force.

## Code references

- Screen (list / detail / sub-screen state machine): `tui/ink/src/images/index.tsx`
- Form (create + edit): `tui/ink/src/images/image-form.tsx`
- Integration class: `tui/ink/src/shared/integrations/image-integration.ts`
- Provider + hooks: `tui/ink/src/rpc-clients-provider.tsx`
- Resource menu / routing: `tui/ink/src/topologies/index.tsx`, `tui/ink/src/{home,app}.tsx`
- Design-system surface: `tui/ink/src/shared/design-system/mod.ts`

## The four UI pieces (client side of a slice)

A feature reaching a new RPC method touches these, in order:

### 1. Integration class — the local SDK

`tui/ink/src/shared/integrations/<bc>-integration.ts`. **One class per RPC
surface.** React-agnostic: no hooks, no Ink, no DOM.

```ts
import type { ImageRegisterRequest, ImageRegisterResponse } from "@jsonrpc-contracts-ts/image.gen.ts";
import type { Client } from "@jsonrpc-client-ts/client.ts";

export class ImageIntegration {
  constructor(private readonly rpc: Client) {}

  register(request: ImageRegisterRequest): Promise<ImageRegisterResponse> {
    return this.rpc.invoke<ImageRegisterResponse>("image.register", request);
  }
}
```

- May import **only** `@jsonrpc-client-ts/` (the `Client` type) and the BC's
  `@jsonrpc-contracts-ts/<bc>.gen.ts`. Never React/Ink, never `@server/*`.
- The RPC method string must match the contract exactly.

### 2. Provider wiring

In `tui/ink/src/rpc-clients-provider.tsx`: import the class, add a `readonly`
field to the `RpcClients` interface, construct it once (`new ImageIntegration(rpc)`)
in the session `useMemo`, expose it on the context value, and add a focused hook
(`export function useImage(): ImageIntegration`). Screens consume the hook, never
construct integrations themselves.

### 3. Screen

`tui/ink/src/<feature>/index.tsx`, `export function <Feature>Screen({ onBack })`.
Drive it with a `subscreen` state machine and one `useInput` per active
sub-screen:

- `list` — load with `useImage()` + `useSessionId()` in a `useEffect`; hold
  `readonly Record[] | null` (null = loading). Render `ScreenFrame` + `Table` +
  `HelpBar`; move the cursor with `useNavigationState`.
- `detail` — open on `↵`; show fields the table omits (e.g. source URL, usage).
- `new` / `edit` — render the `<Feature>Form` (below).
- `confirm-delete` — render the shared `ConfirmDeleteScreen`
  (`@ui/shared/confirm-delete-screen.tsx`): a single confirm word, optional
  `warning` node listing impact. Deleting a still-in-use catalog entry **warns**,
  it does not block.

### 4. Form (create + edit)

`tui/ink/src/<feature>/<feature>-form.tsx`. Prefer the `Form` composite from the
design system over hand-rolled inputs:

- Declarative `Field[]` + `Values`; one `Form` drives both `create` and `edit`
  via a `mode` prop.
- Submit through the integration hook (`imageApi.register({ sessionId, ...values })`);
  show `Spinner` while submitting and an `Alert`/result afterward.
- Resolve actor defaults (`currentUser` / `currentHost`) from `@ui/cli/paths.ts`.

## Navigation registration

- **Resource under topologies:** in `tui/ink/src/topologies/index.tsx` add the
  resource id to the union, an entry `{ id, label, description }`, a count field
  + its fetch, and the route line
  `if (resource === "images") return <ImagesScreen onBack={...} />`.
- **Top-level screen:** add to the `Screen` union in `home.tsx` and the router in
  `app.tsx` (behind `AuthGate` if it needs a session).

## Design-system surface

Import composites/primitives from `@ui/shared/design-system/mod.ts` — don't
reach into files. Available: `ScreenFrame`, `Table`, `Form`, `Wizard`, `Confirm`,
`Alert`, `Select`, `TextInput`, `Spinner`, `Tabs`/`TabBar`, `TaskList`,
`LineChart`, resource-bar helpers, `tokens`. Theme helpers (`DimText`) come from
`@ui/shared/theme/mod.ts`. Reuse before adding a new primitive.

## Tests

Use `ink-testing-library`; always `unmount()` at the end of each `it()`. Seed the
RPC seam with fake integrations through `RpcClientsProvider`'s `clients` prop and
assert on rendered frames. See [tests.md](tests.md).
