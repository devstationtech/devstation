import {
  previousPath,
  type RollbackOutcome,
  type SwapStrategy,
} from "@ui/self-update/installer/installer.ts";
import type { InstallOutcome } from "@ui/self-update/installer/installer.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { fs, env } = denoRuntime;

export class PosixSwapStrategy implements SwapStrategy {
  constructor(private readonly execPath: string = env.execPath()) {}

  async swap(extractedBinary: string): Promise<InstallOutcome> {
    const target = this.execPath;
    const prev = previousPath(target);

    try {
      // Preserve the current binary for rollback.
      await fs.copyFile(target, prev);

      // Try an atomic rename from the stage dir over the target.
      try {
        await fs.rename(extractedBinary, target);
      } catch (err) {
        if (fs.isCrossDevice(err)) {
          // EXDEV: copy into the target's dir then rename within it.
          const tmp = target + ".new";
          await fs.copyFile(extractedBinary, tmp);
          await fs.chmod(tmp, 0o755);
          await fs.rename(tmp, target);
        } else {
          throw err;
        }
      }
      await fs.chmod(target, 0o755);
      return { kind: "installed", previous: prev };
    } catch (err) {
      if (fs.isPermissionDenied(err)) {
        return {
          kind: "failed",
          reason: `no write permission on ${target}. Re-run from a writable install, ` +
            `or reinstall via the install script with appropriate permissions.`,
        };
      }
      return { kind: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  }

  async rollback(): Promise<RollbackOutcome> {
    const target = this.execPath;
    const prev = previousPath(target);
    try {
      await fs.stat(prev);
    } catch {
      return { kind: "nothing" };
    }
    try {
      await fs.rename(prev, target);
      await fs.chmod(target, 0o755);
      return { kind: "rolled-back", restored: target };
    } catch (err) {
      return { kind: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  }
}
