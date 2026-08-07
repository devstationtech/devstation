# Contributing to DevStation

Thanks for your interest! DevStation is **pre-alpha** — the codebase is stable enough to read and
learn from, but APIs and the blueprint DSL may still change between releases.

You don't need to write engine code to contribute: reporting an issue with reproduction steps,
improving the docs, or adding a blueprint to the catalog are all first-class contributions —
blueprints are the easiest place to start.

## Add a blueprint

Blueprints are data, not code — a `blueprints/<name>/blueprint.yaml` plus optional sidecar files. No
TypeScript, no registration: the catalog discovers the folder automatically.

1. Copy the closest existing blueprint instead of starting blank —
   [.agents/skills/blueprint-dsl/references/patterns.md](.agents/skills/blueprint-dsl/references/patterns.md)
   maps every shape in the catalog to a reference implementation.
2. Follow the DSL reference in [docs/blueprint-dsl.md](docs/blueprint-dsl.md): every step idempotent
   (paired with a `verify`), tolerant `uninstall`, `rollback` where a partial apply leaves debris.
3. Validate with `deno task check` and `deno task test` — the blueprint suite parses the real
   `blueprints/` catalog, so a malformed file fails the suite. Update catalog-count assertions when
   you add an entry.
4. If you use an AI assistant, point it at the
   [`blueprint-dsl` skill](.agents/skills/blueprint-dsl/SKILL.md) — it encodes this whole workflow.

To use a blueprint yourself without contributing it, you don't need a PR at all:
`devstation blueprint register ./my-blueprint` installs it into `~/.devstation/blueprints`.
Contribute it to the catalog when you think others would want it too.

## Development setup

DevStation is a [Deno](https://deno.com) 2.x workspace — no `npm install`, no build step for
development:

```bash
git clone https://github.com/devstationtech/devstation
cd devstation
deno task test    # full suite (unit, integration, architecture, UI)
deno task check   # type-check every workspace member
deno task --cwd tui/ink dev      # run the TUI from source
```

The repo is split into workspace members: `server/` (the engine — domain, application, adapters),
`tui/ink/` (the React Ink terminal UI), and `libs/` (reusable, project-agnostic packages).

## Architecture, briefly

The engine follows **hexagonal architecture with tactical DDD**: four layers per bounded context
(`domain` ← `application` ← `inbound` / `outbound`), inner layers never import outer ones, and
inbound/outbound never talk to each other. The UI speaks to the engine **only** over JSON-RPC/stdio.
These rules are not prose — they are enforced by architecture tests in `server/tests/architecture/`
and `tui/ink/tests/architecture/`, including content rules that keep host-runtime access (`Deno.*`)
behind platform facades so the runtime stays swappable.

When in doubt, the existing code of the `cluster` and `station` contexts is the reference
implementation of the project's standards. The engineering blog on
[devstation.tech](https://devstation.tech) covers the reasoning behind these
decisions.

## AI agents & the harness

The `.agents/` directory (rules, skills, specs) and the generated `AGENTS.md` are managed with
[harness](https://github.com/devstationtech/harness) — our CLI for selecting and reusing AI-agent
artifacts across projects, and free for contributors to use too. `harness.yaml` is the committed
manifest; on a fresh clone, `harness apply` reconciles it and regenerates `AGENTS.md`.

If you contribute with an AI assistant, it picks up `AGENTS.md` automatically — the rules there are
the same invariants the architecture tests enforce. To change an artifact, edit it under `.agents/`
and run `harness apply`; never edit `AGENTS.md` by hand.

## Pull requests

- Keep PRs focused; group related changes into coherent commits.
- Commit messages follow **Conventional Commits with a scope** — `feat(station): …`, `fix(mcp): …` —
  where the scope is the bounded context or area touched. PRs are squash-merged, so title the PR in
  the same format.
- **Every behavior change ships with a test** in the existing style: `describe/it` with gherkin
  block comments (`@Given` / `@When` / `@Then`).
- Run the local gate before pushing: `deno fmt --check`, `deno task lint`, `deno task check`,
  `deno task test`. CI additionally runs `deno audit --level=high` (blocking), a smoke compile of
  the linux binary, and a SonarQube quality gate — a PR can pass the four local checks and still
  fail those.
- Releases cut automatically on merge to `main` when the root `deno.json` `version` was bumped to a
  value whose `v<version>` tag doesn't exist yet — so never bump it in a feature PR. The full
  procedure (artifacts, version namespaces, anti-drift rules) is in
  [.agents/skills/contributing/references/release.md](.agents/skills/contributing/references/release.md).
