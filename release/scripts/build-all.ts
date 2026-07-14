/**
 * Builds every compiled artifact — server + UI Ink. Add new UIs
 * (bubbletea, electron) here as they land.
 */
const steps = [
  { label: "server", script: "release/scripts/build-server.ts" },
  { label: "tui/ink", script: "release/scripts/build-ui-ink.ts" },
];

for (const { label, script } of steps) {
  console.log(`\n=== building ${label} ===`);
  const status = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", script],
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!status.success) {
    console.error(`✗ ${label} build failed (exit ${status.code})`);
    Deno.exit(status.code);
  }
}

console.log("\n✓ all builds OK — see dist/");
