---
name: contributing
description: How to ship a change to DevStation — Conventional Commit format with BC scopes, the full CI quality gate (audit, smoke compile and Sonar beyond fmt/lint/check/test), what CI does NOT run (MCP e2e, mutation), the branch model, and the release procedure (version bump rules, tag mechanics, artifacts, anti-drift invariants, the three version namespaces). Use when committing, opening a PR, cutting a release, or bumping any version field.
metadata:
  category: engineering
---

# Contributing & Release

The delivery workflow: how changes are committed, gated, merged, and released.
Code/design standards live in the `code-standards` rule; this skill covers the
process around them.

## Commits

**Conventional Commits with a scope**, strictly:

```text
<type>(<scope>): <imperative subject>
```

- **Types** used in this repo: `feat`, `fix`, `docs`, `chore`, `refactor`,
  `test`, `security`.
- **Scope** is the bounded context or area: `station`, `cluster`, `vault`,
  `auth`, `blueprint`, `mcp`, `provisioning`, `readme`, `agents`, `deps`, …
- Group related files into one coherent commit per concern — no per-file
  micro-commits, no unrelated changes bundled together.
- Every behavior change ships with a test in the same commit set.
- AI-assisted commits keep their `Co-Authored-By:` trailer.

## The real quality gate

CI (`.github/workflows/main.yml` on PRs; the identical `quality` job in
`release.yml` on pushes to `main`) runs, in order:

1. `deno fmt --check`
2. `deno task lint`
3. `deno task check`
4. `deno test -A --v8-flags=--max-old-space-size=4096` (with JUnit + coverage
   output; coverage is reported, **not** thresholded)
5. `deno audit --level=high` — **blocking**; a vulnerable dependency fails the
   PR even when all tests pass
6. Smoke compile: `deno task build:linux -- --version 0.0.0-ci`
7. SonarQube scan with quality-gate wait (when secrets are configured)

Run steps 1–4 locally before pushing; be aware 5–7 can still fail a green PR.

**Not in CI** — run manually when your change touches these areas:

- `deno task mcp:e2e:management` / `mcp:e2e:infra` (live MCP scenarios; need a
  lab + `DEVSTATION_MCP_POLICY`)
- `deno task --cwd server test:mutation` (Stryker)

## Pull requests & branches

- `main` is the PR target and the release-bearing branch. PRs are
  squash-merged (`subject (#NN)`), so keep the PR title in commit format.
- `public-snapshot` / `public-release` are the public-mirror preparation
  branches (parallel history) — never branch feature work from them.
- Keep PRs focused; **never bump `version` in a feature PR** (a version bump
  on `main` is what cuts a release — see below).

## Releases

Read [references/release.md](references/release.md) before touching any
version field. The short form: bump `version` (stable `X.Y.Z`) in the **root
`deno.json` only**; merging that to `main` builds and publishes the release
automatically when the `v<version>` tag doesn't exist yet. Blueprint `version`
bumps follow the policy in the `blueprint-dsl` skill instead.
