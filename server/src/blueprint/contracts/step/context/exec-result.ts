/**
 * Outcome of one shell command run via `ctx.ssh.run(...)`. Blueprint steps inspect
 * `exitCode` to decide whether to fail (non-zero) or read `stdout`/`stderr`.
 */
export interface ExecResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}
