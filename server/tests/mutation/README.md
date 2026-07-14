# Mutation Testing — Stryker harness

Stryker mutation testing against the engine (`server/src/`). Lives in `server/tests/` because it's
server-scoped — same shelf as the MCP e2e harness (`server/tests/mcp/`).

Node-only tool, but no local `node_modules` / `package.json` — invocation is via `npx` on demand.

## How it works

1. Stryker copies the project into a sandbox.
2. For each mutation (small AST change: flip `>` to `>=`, swap `+` with `-`, etc.), it patches one
   file inside the sandbox.
3. The command runner shells out to `deno test … tests/`.
4. Test suite **fails** → mutant **killed** (good — assertions caught it). Test suite **passes** →
   mutant **survived** (gap in coverage).

Survivors land in `server/tests/mutation/reports/mutation/index.html`.

## Run

```bash
deno task test:mutation                   # passthrough — full server suite
MUTATE_BC=auth deno task test:mutation    # scoped to one BC
```

Root `deno.json` chains to `server/deno.json`, which defines the actual invocation:

```
npx --yes --package=@stryker-mutator/core@^8.7 stryker run tests/mutation/stryker.conf.mjs
```

`npx` fetches Stryker into the user's npm cache (`~/.npm/_npx/<hash>/`) on first run; subsequent
runs reuse the cache. The version pin lives in the task size.

`MUTATE_BC` makes the config mutate only `src/<BC>/**` and run only `tests/<BC>/` per mutant.

UI (`tui/ink/src/`) is NOT mutated. React/Ink mutations mostly produce visually-equivalent renders
that the test suite can't catch by construction — would dilute the score without adding signal.

### Custom subset

```bash
cd server
npx --yes --package=@stryker-mutator/core@^8.7 stryker run \
  --mutate 'src/auth/inbound/**/*.ts' \
  tests/mutation/stryker.conf.mjs
```

⚠ Each mutant triggers a fresh `deno test`. **Scope by BC** for sane wall times — the full server
suite has hundreds of mutants.

## Reports

`server/tests/mutation/reports/mutation/index.html` — sortable mutation score per file, color-coded
by threshold; click into a file to see exact survivors.

`incremental` is on by default — subsequent runs only re-test mutants in files that changed.

## Known limitations

- **Slow**: command-runner spawns a fresh `deno test` per mutant. Native Stryker test runners
  (Jest/Vitest) are faster because they reuse the test process, but Deno isn't supported as a native
  runner yet.
- **Type-only mutants** may not be killed — `--no-check` is passed to skip type checking.
  Intentional: type-check failures aren't what mutation testing targets, and full type-checking each
  mutant would blow up wall time.
- **Generators/streams**: stream code may mutate without effect because tests don't always assert on
  every yielded value. Survivors here are signal to strengthen assertions.
- **Deno npm: compat**: running Stryker via `deno run npm:@stryker-mutator/core/stryker` crashes on
  cleanup (`RangeError: code … NaN` from Stryker's `unexpected-exit-handler` — Deno's npm signal
  layer doesn't pass the signal number through). Hence `npx`, not `deno run npm:`.
