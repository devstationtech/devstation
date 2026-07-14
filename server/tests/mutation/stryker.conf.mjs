// Dynamic config. Set MUTATE_BC=<name> to scope mutation + test run to a
// single bounded context (e.g. `MUTATE_BC=auth`). Without it, every
// server BC is mutated and the full server suite runs (slow — CI nightly).
//
// Mutation testing only targets the engine. UI (`tui/ink/src/`) is
// React/Ink — most "mutations" there produce visually-equivalent renders
// that the test suite can't catch by construction. Adding it would
// dilute the mutation score without adding signal.
//
// All paths are relative to `server/` — Stryker is invoked via
// `deno task --cwd server test:mutation` (root has a passthrough task
// of the same name).
const bc = process.env.MUTATE_BC ?? null;

const command = bc
  ? `deno test --no-check --allow-all --quiet tests/${bc}/`
  : "deno test --no-check --allow-all --quiet tests/";

const mutate = bc
  ? [
    `src/${bc}/**/*.ts`,
    `!src/${bc}/**/*.test.ts`,
  ]
  : [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    // Composition roots — no behavior, just wiring; mutating them
    // produces noise without signal.
    "!src/dependencies.ts",
    "!src/container.ts",
    "!src/build-info.ts",
  ];

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "command",
  commandRunner: { command },
  mutate,
  tempDirName: "tests/mutation/.stryker-tmp",
  incremental: true,
  incrementalFile: "tests/mutation/.stryker-tmp/incremental.json",
  concurrency: 4,
  timeoutMS: 60000,
  timeoutFactor: 1.5,
  reporters: ["html", "clear-text", "progress"],
  htmlReporter: { fileName: "tests/mutation/reports/mutation.html" },
  jsonReporter: { fileName: "tests/mutation/reports/mutation.json" },
  thresholds: { high: 80, low: 60, break: 0 },
};
