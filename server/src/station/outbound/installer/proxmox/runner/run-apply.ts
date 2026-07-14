import type { Ssh } from "@server/blueprint/index.ts";
import type { Context as StepContext } from "@server/blueprint/contracts/step/context/context.ts";
import type { Event } from "@server/blueprint/contracts/step/event/event.ts";
import type { Step } from "@server/blueprint/domain/models/step/step.ts";
import type { SecretRedactor } from "@server/station/outbound/installer/proxmox/runner/secret-redactor.ts";
import { renderShell } from "@server/station/outbound/installer/proxmox/runner/render-shell.ts";
import { readPublishedValues } from "@server/station/outbound/installer/proxmox/runner/read-published-values.ts";

/**
 * Executes a step's `shell` against an SSH context: render templates +
 * env exports, run, surface stdout/stderr as log events, fail on non-zero
 * exit, then emit declared `publish` values.
 *
 * Everything that leaves as a log event or error message runs through the
 * `redactor` — captured output and failure text can echo resolved or
 * published secrets. Extraction itself reads the RAW stdout, and
 * `file:`-sourced publishes go over `publishSsh`, a quiet transport with no
 * log sink attached.
 */
export async function* runApply(
  { step, ctx, redactor, publishSsh }: {
    step: Step;
    ctx: StepContext;
    redactor?: SecretRedactor;
    publishSsh?: Ssh;
  },
): AsyncGenerator<Event> {
  const shell = await renderShell({ body: step.shell, env: step.env, ctx });
  // Output is NOT re-emitted here: the installer's SshAdapter log sink already
  // streamed every stdout/stderr line live (redacted, stream-tagged). The old
  // double path printed each remote line twice.
  const result = await ctx.ssh.run(shell);
  const redact = (text: string) => redactor ? redactor.text(text) : text;

  if (result.exitCode !== 0) {
    throw new Error(
      `step '${step.id.value}' failed (exit ${result.exitCode}): ${
        redact(result.stderr || result.stdout)
      }`,
    );
  }

  yield* readPublishedValues({
    ssh: publishSsh ?? ctx.ssh,
    publish: step.publish,
    stdout: result.stdout,
  });
}
