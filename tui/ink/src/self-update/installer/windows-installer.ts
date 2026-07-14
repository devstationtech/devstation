/**
 * Windows swap strategy.
 *
 * Windows locks a running `.exe` — you cannot rename over it from
 * within the process. So `/update` only *stages* the new binary
 * (`<execDir>\devstation.exe.new`) and writes a pending-update marker.
 * The boot-applier (runs at the next launch, before the UI mounts)
 * performs the actual swap while the old image isn't yet locking the
 * target path in a way that blocks the move.
 *
 * Marker: `~/.devstation/pending-update.json`.
 */
import { join } from "@std/path";
import { defaultDevstationHome } from "@ui/cli/paths.ts";
import {
  type InstallOutcome,
  previousPath,
  type RollbackOutcome,
  type SwapStrategy,
} from "@ui/self-update/installer/installer.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { fs, env } = denoRuntime;

export const PENDING_MARKER = "pending-update.json";

export type PendingUpdate = {
  version: string;
  newPath: string;
  targetPath: string;
  previousPath: string;
};

function markerPath(): string {
  const home = env.get("DEVSTATION_HOME") ?? defaultDevstationHome();
  return join(home, PENDING_MARKER);
}

export class WindowsSwapStrategy implements SwapStrategy {
  constructor(private readonly execPath: string = env.execPath()) {}

  async swap(extractedBinary: string, version: string): Promise<InstallOutcome> {
    try {
      const target = this.execPath;
      const newPath = target + ".new";
      await fs.copyFile(extractedBinary, newPath);

      const pending: PendingUpdate = {
        version,
        newPath,
        targetPath: target,
        previousPath: previousPath(target),
      };
      const home = env.get("DEVSTATION_HOME") ?? defaultDevstationHome();
      await fs.mkdir(home, { recursive: true });
      await fs.writeTextFile(markerPath(), JSON.stringify(pending, null, 2) + "\n");

      return { kind: "staged", version };
    } catch (err) {
      return { kind: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  }

  async rollback(): Promise<RollbackOutcome> {
    const prev = previousPath(this.execPath);
    try {
      await fs.stat(prev);
    } catch {
      return { kind: "nothing" };
    }
    // On Windows the live .exe is locked; stage the rollback the same
    // way an update is staged — applied on next boot.
    try {
      const newPath = this.execPath + ".new";
      await fs.copyFile(prev, newPath);
      const pending: PendingUpdate = {
        version: "rollback",
        newPath,
        targetPath: this.execPath,
        previousPath: prev,
      };
      await fs.writeTextFile(markerPath(), JSON.stringify(pending, null, 2) + "\n");
      return { kind: "rolled-back", restored: this.execPath };
    } catch (err) {
      return { kind: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  }
}

export { markerPath as pendingMarkerPath };
