import type { Process } from "@server/shared/process/domain/ports/outbound/process.ts";

/**
 * Connection target for the SSH transport.
 *
 * Key-based authentication only: `identityFile` is the absolute path
 * to a private key whose public counterpart is in the remote's
 * `~/.ssh/authorized_keys`. The vault still stores password credentials
 * for users to log in manually, but the CLI no longer spawns `sshpass`.
 */
export type Target = {
  host: string;
  user: string;
  identityFile: string;
};

export type SshEvent =
  | { type: "log"; stream: "stdout" | "stderr"; line: string }
  | { type: "done"; code: number; stdout: string; stderr: string };

export class SshCli {
  constructor(private readonly process: Process) {}

  async *run(target: Target, command: string, signal?: AbortSignal): AsyncIterable<SshEvent> {
    const args = [
      "-i",
      target.identityFile,
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "UserKnownHostsFile=/dev/null",
      "-o",
      "LogLevel=ERROR",
      // BatchMode + IdentitiesOnly enforce the key-only contract:
      // - BatchMode=yes makes ssh fail fast if it would have asked
      //   for a password / passphrase (otherwise it would hang
      //   waiting for stdin we never feed it).
      // - IdentitiesOnly=yes tells ssh to use only the key we pass
      //   via -i, even if ssh-agent has other identities loaded
      //   (avoids "Too many authentication failures" when the agent
      //   has many keys for this host).
      "-o",
      "BatchMode=yes",
      "-o",
      "IdentitiesOnly=yes",
      `${target.user}@${target.host}`,
      // The actual command travels over STDIN, never argv: rendered install
      // scripts embed resolved secrets, and local argv is world-readable
      // (`/proc/<pid>/cmdline`) while the remote command shows up in `ps`
      // for the whole run. All install targets are Linux, so `bash -s`
      // matches the login-shell semantics argv execution had.
      "bash -s",
    ];

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let code = 0;

    for await (const event of this.process.run({ command: "ssh", args, signal, stdin: command })) {
      if (event.type === "stdout") {
        const line = sanitize(event.line);
        stdoutChunks.push(line);
        yield { type: "log", stream: "stdout", line };
      } else if (event.type === "stderr") {
        const line = sanitize(event.line);
        stderrChunks.push(line);
        yield { type: "log", stream: "stderr", line };
      } else {
        code = event.code;
      }
    }

    yield {
      type: "done",
      code,
      stdout: stdoutChunks.join("\n"),
      stderr: stderrChunks.join("\n"),
    };
  }
}

// deno-lint-ignore no-control-regex -- ESC (\x1b) is the literal start of an ANSI sequence
const ANSI_ESCAPE = /\x1b\[[0-9;?]*[a-zA-Z]/g;

/**
 * Strips ANSI escape sequences and stray carriage returns from a remote shell
 * line so the TUI box renderer doesn't mis-measure widths or jump the cursor.
 */
function sanitize(line: string): string {
  // deno-lint-ignore no-control-regex -- intentionally strips raw C0/C1 control bytes
  return line.replace(ANSI_ESCAPE, "").replace(/\r/g, "").replace(/[\x00-\x08\x0B-\x1f\x7f]/g, "");
}
