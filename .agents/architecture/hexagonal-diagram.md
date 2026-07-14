# Hexagonal architecture — the "Ports & Adapters" diagram (visual reference)

This document is the key that lets an agent **read the DevStation ports-&-adapters
diagram and relate every element to the actual code**. Consult it whenever the
diagram is referenced, when reasoning about where a change belongs, or when adding
a new adapter/port/context.

- **Image (source of truth for the picture):** `website/public/blog/devstation-hexagonal.svg`
  (sibling repo `devstationtech/website`). It is the cover of the engineering post
  `designed-for-extensibility`.
- **The image is symbolic and grouped BY CATEGORY, not by bounded context.** One
  amber face = one *kind* of port; one target = one real technology adapter,
  drawn once even though several contexts use it. The tables below expand each
  symbol into the real, per-context code.

## How to read it

An **App Core** polygon (regular, centred). Its interior is two concentric rings:
the **Application** layer wrapping the **Domain**. The polygon **faces are the
ports**. The **left half is inbound (PRIMARY · driving)**, the **right half is
outbound (SECONDARY · driven)** — a light vertical line splits the two. **Every
dependency points inward** (adapters depend on ports; the domain depends on
nothing outside).

## App Core interior → code

| In the image | Meaning | Code |
| --- | --- | --- |
| **Application** — `commands · queries · handlers` | Use-case layer: command handlers (write), query handlers (read, CQRS read side bypasses aggregates), policies dispatch | `server/src/<bc>/application/{commands,queries,handlers,policies}` |
| **Domain** — `aggregates · entities · value objects · events` | Pure domain model, no infra imports | `server/src/<bc>/domain/**` |

`<bc>` ∈ `cluster`, `vault`, `station`, `size`, `images`, `auth`, plus `shared`
(building-blocks / shared kernel).

## Inbound — left faces (PRIMARY · driving)

Entry points (grey dashed icons) drive the core through **driving adapters**,
which call the **inbound ports** on the left faces. The TUI is **not** a direct
caller of the core — it is a JSON-RPC client (enforced: UI has zero `@server/*`
imports; see SPEC-050).

| In the image | Meaning | Code |
| --- | --- | --- |
| **CLI** (entry point) → **TUI** | Terminal launches the React Ink UI | `tui/ink/**` (client only) |
| **TUI** → **RPC** | The UI talks to the engine over JSON-RPC/stdio | `server/src/<bc>/inbound/rpc/**`, contracts in `libs/jsonrpc-schemas/*.openrpc.json` → generated `libs/jsonrpc-contracts-ts/src/<bc>.gen.ts` |
| **AI agent** (entry point) → **MCP** | Agents drive the same engine via MCP tools | `server/src/<bc>/inbound/mcp/**` (MCP re-expresses the RPC surface) |
| **Commands** (inbound port face) | Write API the driving adapters invoke | `server/src/<bc>/application/commands` + `domain/ports/inbound/command.ts` |
| **Queries** (inbound port face) | Read API | `server/src/<bc>/application/queries` |

**RPC and MCP are the real inbound adapters** that reach the ports; CLI and the AI
agent are external actors upstream of them.

### Policies + the event loop (top dashed arrow)

`domain events → policies listen → dispatch commands`. Cross-context integration
is **never direct**: a policy in one context reacts to another context's domain
event and dispatches a command of its own. Policies are event-driven drivers
(inbound), not part of the Application layer's synchronous call path.

| In the image | Code |
| --- | --- |
| **Policies** (event-driven) | `server/src/<bc>/application/policies/**` |
| Event loop / **Events** outbound port → `EventBusAdapter` (in-process) | Ports `shared/building-blocks/domain/ports/events/outbound/{bus,dispatcher,policy}.ts`; adapter `shared/building-blocks/outbound/events/**` |

## Outbound — right faces (SECONDARY · driven)

Each right face is a **category** of outbound port → one **adapter** → one real
**target**. The engine reaches the world only through these.

| Face (port) | Adapter (image) | Target | Real code |
| --- | --- | --- | --- |
| **Persistence** | `FileSystemAdapter` | Disk | `server/src/<bc>/outbound/persistence/file-system/**` (clusters.json, stations.json, sizes, images, blueprints; auth `outbound/local-resources`; secrets). Ports: `<bc>/domain/ports/outbound/{clusters,stations,vaults,sizes,images,image-usages}.ts`, `auth/.../{token-store,...}` |
| **Provider** | `HttpAdapter` | Proxmox | `server/src/shared/http/outbound/**` used by the Proxmox provider; cluster read/query side of Proxmox |
| **Execution** | `SshAdapter` | Proxmox (node) | `server/src/station/outbound/installer/proxmox/runner/**` + `server/src/shared/ssh/outbound/**` (port `station/domain/ports/outbound/installer.ts`, `shared/ssh/.../ssh-bootstrap.ts`) |
| **Provisioning** | `OpenTofuAdapter` | Proxmox | `server/src/cluster/outbound/executions/proxmox/provisioning/**` (runs the OpenTofu binary via the process port `shared/process/domain/ports/outbound/process.ts`, adapter `shared/process/outbound/**`); templates under `.../provisioning/templates` |
| **Logging** | `StdoutAdapter` | Console | `server/src/shared/observability/outbound/**` (port `shared/observability/domain/ports/outbound/logger.ts`) |
| **Events** | `EventBusAdapter` | in-process | `server/src/shared/building-blocks/outbound/events/**` |

### Real outbound ports the diagram groups

The picture shows ~6 categories; the engine actually declares more granular
outbound ports (grouped above). Full list of `domain/ports/outbound`:
`cluster/{clusters, storage-type-resolver, executions/proxmox/images/images,
executions/proxmox/provisioning/provisioning}`, `vault/{crypto, vaults}`,
`station/{blueprints, installer, stations}`, `size/sizes`,
`images/{images, image-usages}`, `auth/{auth, key-wrap, sessions, token-store}`,
`shared/{authentication, authentication/session-resolver,
executions/{emitter, executions}, observability/logger, process/process,
secrets/secret-resolver, ssh/ssh-bootstrap,
building-blocks/events/{bus, dispatcher, policy}}`.

Notes:
- **Crypto** is not a separate target in the image — key-wrap/token storage is
  ultimately file-system too (`auth/outbound/local-resources`, `vault` crypto over
  files); folded into Persistence.
- `station/outbound/deployer/**` is legacy naming alongside `installer` (term is
  install/uninstall); the diagram uses **Execution → SSH**.

## Invariants the diagram encodes (checked by arch tests)

- The **domain imports no infrastructure**; the **inbound side never imports the
  outbound side**; dependencies point inward.
- The **UI reaches the engine only via JSON-RPC** (no `@server/*` imports) — that
  is why TUI sits behind RPC, not on the core.
- **Cross-context communication is only via domain events + policies**, never a
  direct call — that is the top event loop.
- New work mirrors this shape: a new driven integration = a new outbound port +
  adapter (right face); a new driving surface = an inbound adapter behind
  Commands/Queries (left); a new context = its own `application` + `domain` +
  `inbound` + `outbound`, integrating only through events.

## Regenerating the image

The SVG is generated deterministically by `website/scripts/gen-hexagonal-diagram.mjs`
(run: `node scripts/gen-hexagonal-diagram.mjs public/blog/devstation-hexagonal.svg`).
The picture is derived from `CC`/`R` + the port/adapter/actor lists in that script.
When the architecture changes (new port category, renamed adapter, new entry point),
update the script, regenerate the SVG, and update this table together so the
diagram, the generator, and this reference stay in sync.
