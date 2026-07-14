import type { Spawn } from "@jsonrpc-client-ts/spawn.ts";

/**
 * Deno implementation of the `Spawn` contract. Opt-in import for Deno
 * consumers (tests, scripts) — the DevStation TUI injects its own spawner
 * through its platform runtime facade instead.
 */
export const denoSpawn: Spawn = (command, args) => {
  const child = new Deno.Command(command, {
    args: [...args],
    stdin: "piped",
    stdout: "piped",
    stderr: "inherit",
  }).spawn();
  return {
    stdin: child.stdin,
    stdout: child.stdout,
    status: child.status,
    kill: () => {
      try {
        child.kill("SIGTERM");
      } catch {
        // already exited
      }
    },
  };
};
