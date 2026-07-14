import type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";
import type { Event } from "@server/blueprint/contracts/step/event/event.ts";
import { renderShell } from "@server/station/outbound/installer/proxmox/runner/render-shell.ts";
import { emitOutputLines } from "@server/station/outbound/installer/proxmox/runner/output-events.ts";

/**
 * Best-effort rollback. The installer surfaces output as logs but does not
 * fail the run on a rollback error — a non-zero exit is reported as a log
 * line so the operator knows the compensation may be incomplete.
 */
export async function* runRollback(
  { shell, ctx }: { shell: string; ctx: StepContext },
): AsyncGenerator<Event> {
  const rendered = await renderShell({ body: shell, env: {}, ctx });
  const result = await ctx.ssh.run(rendered);
  yield* emitOutputLines(result.stdout, result.stderr);
  if (result.exitCode !== 0) {
    yield {
      type: "log",
      level: "warn",
      message: `rollback exited ${result.exitCode} (best-effort, continuing)`,
    };
  }
}
