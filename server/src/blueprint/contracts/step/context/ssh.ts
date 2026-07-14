import type { ExecResult } from "@server/blueprint/contracts/step/context/exec-result.ts";

/**
 * Transport contract step authors consume via `ctx.ssh`. Implemented by the
 * installer adapter (e.g. `ProxmoxInstaller` adapts `SshCli`); stays a type so
 * the stack module never depends on a specific transport.
 */
export interface Ssh {
  run(command: string, opts?: { sudo?: boolean; timeout?: number }): Promise<ExecResult>;
  upload(localPath: string, remotePath: string): Promise<void>;
}
