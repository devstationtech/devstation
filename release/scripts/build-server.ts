/**
 * Compiles the standalone server binary — `dist/devstation-server`.
 * Spawned by the UI binary via stdio (or by any non-TS client: Go, etc.).
 */
const cmd = new Deno.Command(Deno.execPath(), {
  args: [
    "compile",
    "-A",
    "--output",
    "dist/devstation-server",
    "server/bin/devstation-server",
  ],
  stdout: "inherit",
  stderr: "inherit",
}).spawn();

const status = await cmd.status;
Deno.exit(status.code);
