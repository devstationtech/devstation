import type { Event } from "@server/blueprint/contracts/step/event/event.ts";

/**
 * Splits captured stdout/stderr into per-line `log` events. stdout maps to
 * info, stderr to warn — empty lines are dropped.
 */
export function* emitOutputLines(stdout: string, stderr: string): Generator<Event> {
  for (const line of stdout.split("\n")) {
    if (line) yield { type: "log", level: "info", message: line };
  }
  for (const line of stderr.split("\n")) {
    if (line) yield { type: "log", level: "warn", message: line };
  }
}
