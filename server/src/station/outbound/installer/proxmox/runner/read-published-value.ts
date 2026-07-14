import type { Ssh } from "@server/blueprint/index.ts";
import type { PublishSource } from "@server/blueprint/domain/models/step/publish-source.ts";
import { shellQuote } from "@server/station/outbound/installer/proxmox/runner/shell-quote.ts";

/**
 * Resolves a single `PublishSource` into its value. `file:` triggers a remote
 * `cat`; `stdoutLine:` scans captured stdout for the first match.
 *
 * The `ssh` must be a QUIET transport (no log sink): the value being read
 * is, by declaration, a secret — streaming the `cat` output to the
 * execution log would publish it to every watcher.
 */
export async function readPublishedValue(
  { ssh, source, stdout }: { ssh: Ssh; source: PublishSource; stdout: string },
): Promise<string> {
  if (source.kind === "file") {
    const result = await ssh.run(`sudo cat ${shellQuote(source.path)}`);
    if (result.exitCode !== 0) {
      throw new Error(`publish: failed to read ${source.path} (exit ${result.exitCode})`);
    }
    return result.stdout.trim();
  }
  for (const line of stdout.split("\n")) {
    if (line.startsWith(source.prefix)) {
      return line.slice(source.prefix.length).trim();
    }
  }
  throw new Error(`publish: no stdout line starting with '${source.prefix}'`);
}
