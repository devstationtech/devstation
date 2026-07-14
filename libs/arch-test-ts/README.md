# @arch — architectural tests for Deno

Fluent arch tests inspired by [Pest](https://pestphp.com)'s `arch()` API, adapted for TS/Deno. Each
rule is one `arch()` chain; the assertion call registers it as an `it()` test.

The package is intentionally **unopinionated** about project layout. It only provides primitives —
bounded contexts, hexagonal layers, MVC controllers, or any other architectural concept are
expressed directly in your rules.

## Quick start

```ts
import { arch } from "@arch-test-ts/mod.ts";

arch.configure({ root: new URL("../../", import.meta.url) });

arch("auth: isolated from other contexts")
  .expect("src/auth/{domain,application,inbound,outbound}/**")
  .toOnlyImport(["src/auth/**", "src/shared/**"]);

arch("ui does not import application handlers")
  .expect("cli/ui/**")
  .toNotImport("src/*/application/handlers/**");

arch("cluster providers UI is only used by the dispatcher")
  .expect("cli/ui/cluster/providers/**")
  .toOnlyBeImportedBy("cli/ui/cluster/detail.tsx", { within: "cli/ui/" });

arch("station: isolated except for sanctioned blueprint bridges")
  .expect("src/station/{domain,application,inbound,outbound}/**")
  .toOnlyImport(["src/station/**", "src/shared/**"])
  .ignoring([
    { from: "src/station/outbound/blueprints/**", to: "src/blueprint/**" },
    { from: "src/station/outbound/installer/**", to: "src/blueprint/**" },
  ]);
```

Each `arch(name).expect(...)…assertion()` chain registers exactly one `it()`. The assertion call is
what registers the test; subsequent `.ignoring()` calls mutate the rule before its deferred
execution.

## API

### `arch.configure({ root, exts? })`

Call once per test file, before any `arch()` call.

- `root` — `URL` pointing to the project root.
- `exts` — file extensions to scan (default: `[".ts", ".tsx"]`).

### `arch(name)`

Returns an `ArchBuilder`. Chain `.expect(...)` then one assertion method to register an
`it(name, ...)`.

### `.expect(source)`

Selects the source files the rule asserts on. Accepts a glob or a list of globs.

### Assertions

All assertions are single methods with the `to*` prefix, mirroring BDD matchers (`toBe`, `toEqual`,
…) and matching the relationship under test (`Import`, the natural verb in TS).

#### `.toImport(target)`

Source files **must** import at least one dependency matching `target`.

#### `.toNotImport(target)`

Source files **must not** import dependencies matching `target`.

#### `.toOnlyImport(targets)`

Source files may **only** import dependencies that match `targets` (plus externals like `jsr:` and
`npm:`, which are always allowed). Any other project-internal import is a violation. Express
isolation positively without listing every forbidden target.

#### `.toOnlyBeImportedBy(allowedUsers, options?)`

Source files **may only be imported by** files matching `allowedUsers`. By default, the lookup scope
is `cli/` and `src/`; override with `options.within`.

#### `.ignoring(spec)`

Carves out exceptions to the preceding assertion (chains after any of the `to*Import*` calls).
Accepts:

- a path glob: `ignoring("cli/ui/cluster/providers/**")` — file-based, exempt these files entirely
- a list of globs: `ignoring(["a", "b"])` — same, multiple paths
- a structured exception: `ignoring({ from: "...", to: "...", reason: "..." })`
- a list of structured exceptions: `ignoring([{ to: "..." }, { from: "...", to: "..." }])`

`from` matches the importing file; `to` matches the imported dependency. Omit either to match
everything on that side.

### `discover(options)`

Returns the names of top-level directories under a project-relative path that match a criterion.
Useful for declaring rules across every matching directory without hardcoding the list.

```ts
const contexts = await discover({
  in: "src/",
  containing: "domain/",   // require a `domain/` subdir
  exclude: ["query", "shared"],
});

for (const ctx of contexts) {
  arch(`${ctx}: ...`).expect(...);
}
```

- `in` — project-relative path to scan
- `containing` — optional; only include directories that have this child entry. Use a trailing `/`
  to require a subdirectory (e.g. `"domain/"`), omit it to accept a file or directory.
- `exclude` — directory names to skip

## Glob syntax

- `*` — single segment (no `/`)
- `**` — any number of segments
- `{a,b}` — alternation
- everything else literal

Paths are relative to the project root (e.g. `src/auth/domain/models/session.ts`).

## Design

- **One rule, one test.** Each `arch()` call registers exactly one `it()`. Want to assert two
  things? Two `arch()` calls.
- **Fluent chain, single-method assertions.** `arch().expect().toNotImport().ignoring()`. No
  property-getter trickery (`.not`), no compositional fragment arrays — just chained methods.
- **Unopinionated.** No built-in notion of bounded contexts, hexagonal layers, MVC controllers,
  presets, or anything else. Project conventions are expressed directly in the rules.
- **One file per concern.** Recommended layout: one test file per bounded context (or per
  layer/area), each declaring its own rules. Each file's rules read top-to-bottom with no shared
  state or dynamic generation.
