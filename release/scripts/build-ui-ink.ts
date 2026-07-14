/**
 * Compiles the Ink TUI binary — `dist/devstation`.
 *
 * Today: the binary is the UI launcher (default → TUI; subcommands
 * `mcp serve`, `mcp install`). It spawns `dist/devstation-server` as a
 * subprocess for the JSON-RPC channel.
 *
 * The two binaries ship side-by-side: the UI launcher and the engine server.
 */
const cmd = new Deno.Command(Deno.execPath(), {
  args: [
    "compile",
    "-A",
    "--output",
    "dist/devstation",
    "tui/ink/bin/devstation",
  ],
  stdout: "inherit",
  stderr: "inherit",
}).spawn();

const status = await cmd.status;
Deno.exit(status.code);
