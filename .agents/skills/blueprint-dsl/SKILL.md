---
name: blueprint-dsl
description: Author or change a service blueprint — the declarative YAML DSL (blueprints/<name>/blueprint.yaml, or user-local via `devstation blueprint register`). Standalone vs hosted shapes, steps with verify/publish/rollback, uninstall, shell templating, ${file:} sidecars, version-bump policy, and validation against the strict parser. Use when adding or changing a blueprint; NOT for engine/UI code (use low-level-design).
metadata:
  category: engineering
  language: yaml
---

# Blueprint DSL

The how-to for adding a **service blueprint** — a declarative recipe that
installs and operates software on VMs over SSH. Blueprints are data, not code:
no TypeScript, no registration.

A blueprint lives in `<name>/blueprint.yaml` (plus optional sidecar files) and
has two possible destinations, with an identical DSL in both:

- **Repo catalog** — `blueprints/<name>/`, contributed via PR and bundled with
  DevStation. The `Blueprints` catalog (`server/src/blueprint/blueprints.ts`)
  scans every subdirectory on startup and exposes it to the operator's register
  flow automatically. **Dropping the folder in is the whole installation step** —
  there is nothing to wire.
- **User-local catalog** — `~/.devstation/blueprints/<name>/`, for a user's own
  blueprints. Install one with `devstation blueprint register ./my-blueprint`
  (a directory or the `blueprint.yaml` itself): it validates with the real
  parser and copies the folder into place. A same-name user blueprint overrides
  the bundled one (`--force` required to shadow an existing name).

The parser is **strict and fail-fast**: an invalid blueprint throws at load with
the offending path. A JSON Schema at `blueprints/blueprint.v1.schema.json` gives
editor autocomplete and inline validation.

## Two shapes

- **Standalone** — declares `roles[]`; each role runs its own steps on its own
  VMs. Examples: `docker`, `k3s`.
- **Hosted** — declares `host: { blueprint, role }` + top-level `install[]`; brings
  no VMs, runs on a host service's VMs. Examples: `argocd` on `k3s.server`,
  `portainer` on `docker.main`.

## Pick the reference for your activity

| Doing | Read |
|---|---|
| The end-to-end authoring workflow + project conventions + how to validate | [authoring.md](references/authoring.md) |
| Which existing blueprint to copy for your case (annotated catalog) | [patterns.md](references/patterns.md) |
| Exact field-by-field DSL reference (every key, every table) | [`docs/blueprint-dsl.md`](../../../docs/blueprint-dsl.md) |

The DSL doc is the **canonical field reference** — this skill does not repeat its
tables; it tells you how to use them to build a blueprint in this repo.

## Creation checklist

1. **Pick the shape** — standalone (owns VMs) or hosted (runs on a host role)
   ([authoring.md](references/authoring.md)).
2. **Copy the closest sibling** from the catalog rather than starting blank
   ([patterns.md](references/patterns.md)).
3. **Scaffold** `blueprints/<name>/blueprint.yaml`; `name` must equal the folder.
   Set `description`, `version`, `compatibility.os` (from the four supported OSes).
   When changing an existing blueprint, bump `version` per the policy in
   [authoring.md](references/authoring.md) — never ship changed steps under the
   same version.
4. **Author steps** — `run`/`script`, each with an idempotent `verify`; capture
   handoff values with `publish` (secret/fact); add `rollback` where an apply can
   leave debris.
5. **Add `uninstall`** — per role (standalone) or top-level (hosted); teardown runs
   in reverse role order.
6. **Templating & sidecars** — reference `${inputs.X}` / `${secrets.X}` /
   `${peer...}`; inline compose/operator files with `${file:...}`; put shell in
   `scripts/*.sh` when it grows.
7. **Validate** — repo catalog: `deno task check` and `deno task test` (the
   blueprint suite parses the real `blueprints/` catalog via `bootstrap.ts`, so a
   malformed file fails the suite). User-local: `devstation blueprint register
   ./my-blueprint` runs the same parser and reports errors up front. See
   [authoring.md](references/authoring.md).

Mirror the closest existing blueprint exactly; do not invent new structure.
