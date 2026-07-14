# Reference: Authoring Workflow & Conventions

Project-specific how-to for creating a blueprint. For the exhaustive field tables
see [`docs/blueprint-dsl.md`](../../../../docs/blueprint-dsl.md); this file covers
the workflow, the conventions the existing catalog follows, and validation.

## Where it lives & how it loads

- One directory per blueprint: `<name>/blueprint.yaml` (the required
  entrypoint), plus optional sidecars (`scripts/*.sh`, `*.yaml` compose/operator
  files).
- `name` **must equal the folder name** (kebab-case). The catalog keys on it.
- Two destinations, same DSL: the **repo catalog** (`blueprints/<name>/`,
  bundled with DevStation) and the **user-local catalog**
  (`~/.devstation/blueprints/<name>/`). Both roots are merged; a same-name
  user blueprint overrides the bundled one.
- Repo catalog discovery is automatic — `Blueprints`
  (`server/src/blueprint/blueprints.ts`) scans subdirectories, parses each
  entrypoint, and caches the result. No registration, no code change. It appears
  in the operator's register picker on next start.
- User-local blueprints are installed with `devstation blueprint register
  ./my-blueprint` (a directory or the `blueprint.yaml` itself) — it validates
  with the real parser, reports errors up front, and copies the folder into
  place. It refuses to shadow an existing name unless `--force` is given.
- The JSON Schema `blueprints/blueprint.v1.schema.json` is the published
  structural contract (draft 2020-12). Start every `blueprint.yaml` with the
  modeline so editors validate + autocomplete against it:
  ```yaml
  # yaml-language-server: $schema=https://raw.githubusercontent.com/devstationtech/devstation/main/blueprints/blueprint.v1.schema.json
  ```
  It's a **real** contract, not decoration: `blueprint register` runs a
  structural schema check before the parser (catching typo'd/unknown fields the
  parser ignores — `additionalProperties: false`), and a CI drift-gate
  (`server/tests/blueprint/integration/schema-conformance.test.ts`) validates
  the whole catalog against it. The hand-written parser stays the semantic
  source of truth; if you add a DSL field to the parser, update the schema too
  or the drift-gate fails.

## Choose the shape

- **Standalone** (`roles[]`) when the service owns its VMs. Each role has its own
  steps; later roles read earlier ones via `${peer.<role>...}`.
- **Hosted** (`host: { blueprint, role }` + top-level `install[]`) when it runs on
  another service's VMs (e.g. a workload on `k3s.server`). Brings no VMs.
- `roles` and `host` are mutually exclusive. A hosted blueprint requires
  top-level `install`; a standalone keeps steps inside each role.

## Top-level essentials

- `description` — one line shown in the catalog.
- `version` — semver of the blueprint itself (independent of the software).
- `compatibility.os` — subset of the four supported OSes: `ubuntu-22-04`,
  `ubuntu-24-04`, `debian-12`, `debian-13`. Register fails fast on an
  incompatible VM (`BlueprintOsIncompatible`).
- `inputs[]` — operator-supplied values; `type: secret` lands in the vault and is
  read back via `${secrets.X}`. Reserve `default` for non-secret types.

## Versioning the blueprint

`version` is the blueprint's own semver — the version of **the recipe
itself**. Don't confuse the three version planes:

- `version` (this field) — the recipe: its steps, inputs, sidecars.
- The **DSL/schema version** — the `v1` in `blueprint.v1.schema.json`; the
  structural contract every blueprint is written against. It is implicit (no
  YAML field declares it); a breaking DSL change would introduce a
  `blueprint.v2` schema + parser.
- The **installed software's version** — not a field at all; it lives inside
  steps (image tags, manifest URLs).

`version` is validated at parse time and recorded on every install for
audit — the engine does not (yet) compare versions or drive upgrades, but the
recorded value is how an operator tells which recipe a service was installed
from, so **bump it on every behavioral change**:

- **patch** — fix inside an existing step (a hardened `verify`, a corrected
  flag) that changes no input, output, or sidecar.
- **minor** — additive change: a new input with a default, a new sidecar, a new
  step, a new published fact/secret (e.g. jenkins `1.0.0 → 1.1.0` when it
  gained the `security.groovy` bootstrap sidecar).
- **major** — breaking change: an input added/renamed without a default, a
  role added/renamed, a published secret/fact renamed or removed, or a `host`
  change — anything that would make an existing install's recorded inputs or
  peers invalid.

Never change steps without bumping; two different recipes must never share a
version.

## Step conventions (followed across the catalog)

- **Every step is idempotent.** Pair `run`/`script` with a `verify` that exits 0
  when already-healthy so re-runs are safe. Use `apply -f - --dry-run=client |
  apply -f -` style for k8s, `--ignore-not-found` on deletes, `systemctl
  is-active`/`command -v` guards.
- **`verify.retry`** (`count`, `intervalSeconds`) for things that converge
  asynchronously (a daemon coming up, a rollout finishing).
- **`publish`** captures handoff values after a step succeeds: `secret` (to the
  vault, read by peers via `${peer.<role>.secrets.X}`) or `fact` (UI-visible
  outputs). Sources are `file:/path` or `stdout-line:PREFIX=`.
- **`rollback`** only runs when that step's apply fails — add it where a partial
  apply leaves debris.
- **Inline shell** goes in `run`; promote to `script: scripts/<x>.sh` once it
  grows beyond a few lines.

## Teardown: `uninstall`

- Standalone: declare `uninstall` **per role**; roles tear down in reverse
  declaration order. Hosted: declare `uninstall` at the **top level** beside
  `install`.
- Same step shape as `install` (run/script, verify, templating). Make deletes
  tolerant (`--ignore-not-found`, `|| true`, existence guards) — destroy must not
  fail on already-gone resources.

## Templating & sidecars

- `${inputs.X}`, `${secrets.X}`, `${role}`, `${host}`,
  `${peer.<role>[N].{host,secrets.X,outputs.X}}` resolve per host at install time
  (not shell substitution — unknown placeholders fail loudly).
- `${file:relative.yaml}` inlines a sibling file at parse time. Use a
  single-quoted heredoc (`<<'EOF'`) so the inlined content isn't re-interpolated
  by the shell. This is how compose/operator manifests are shipped.
- **Brace expansions are reserved for the template engine.** Any brace-form
  `$`-expression the resolver doesn't recognise fails the install loudly, so
  shell (inline `run`, `scripts/*.sh`, and everything inlined via `${file:...}`
  — compose files, embedded reconcilers) must use unbraced `$VAR` only. The
  catalog templating test (`server/tests/blueprint/integration/
  catalog-templating.test.ts`) renders every shipped shell string and fails on
  stray placeholders.

## Validate

1. `deno task check` — types/lint across the workspace.
2. `deno task test` — the blueprint suite points a real `FileSystem` at the
   actual `blueprints/` directory (`server/tests/blueprint/fixtures/bootstrap.ts`,
   `CATALOG_ROOT = "blueprints"`). A blueprint that fails to parse fails the
   suite, so this is your end-to-end check.
   - If a list/by-id test asserts on catalog contents or count, update it when
     you add a blueprint.
3. For a **user-local** blueprint (not contributed to the repo), skip the deno
   tasks: `devstation blueprint register ./my-blueprint` runs the same strict
   parser and installs it into `~/.devstation/blueprints` in one step.
4. Optional live check: register + install the service on a lab node over SSH.

Keep the YAML valid against `blueprints/blueprint.v1.schema.json` throughout.
