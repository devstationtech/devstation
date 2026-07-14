import type { ExecResult, Ssh } from "@server/blueprint/index.ts";
import type { SshCli, Target } from "@server/shared/ssh/outbound/cli.ts";

export type LogSink = (stream: "stdout" | "stderr", line: string) => void;

/**
 * Adapts SshCli to the Ssh contract consumed by stack Step functions. Pure
 * transport — no retry, no provisioning awareness. Waiting for sshd to come up
 * after cloud-init is the installer's responsibility (see waitForSshReady),
 * called once before the first step runs.
 */
export class SshAdapter implements Ssh {
  constructor(
    private readonly cli: SshCli,
    private readonly target: Target,
    private readonly signal: AbortSignal,
    private readonly logSink: LogSink | null = null,
  ) {}

  async run(
    command: string,
    opts?: { sudo?: boolean; timeout?: number },
  ): Promise<ExecResult> {
    const cmd = opts?.sudo ? `sudo sh -c '${command.replace(/'/g, "'\\''")}'` : command;
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let exitCode = 0;

    for await (const event of this.cli.run(this.target, cmd, this.signal)) {
      if (event.type === "log") {
        (event.stream === "stderr" ? stderrChunks : stdoutChunks).push(event.line);
        this.logSink?.(event.stream, event.line);
      } else {
        exitCode = event.code;
      }
    }

    return {
      exitCode,
      stdout: stdoutChunks.join("\n"),
      stderr: stderrChunks.join("\n"),
    };
  }

  upload(_localPath: string, _remotePath: string): Promise<void> {
    return Promise.reject(new Error("ssh.upload() is not yet implemented."));
  }
}
