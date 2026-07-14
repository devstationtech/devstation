/**
 * Applies a staged update at boot, BEFORE the UI mounts. Windows-only
 * in effect (POSIX swaps in place during `/update`), but safe to call
 * on every boot and every OS — it's a no-op when there's no marker.
 *
 * Defensive by construction: any failure is swallowed and the boot
 * continues on the current binary. A corrupt marker is removed so it
 * can't wedge future boots. We never auto-relaunch — we print a short
 * notice and let the user reopen.
 */
import { join } from "@std/path";
import { defaultDevstationHome } from "@ui/cli/paths.ts";
import { VERSION } from "@ui/cli/version.ts";
import { compareSemver } from "@ui/self-update/version.ts";
import { PENDING_MARKER, type PendingUpdate } from "@ui/self-update/installer/windows-installer.ts";
import { denoRuntime } from "@ui/shared/platform/mod.ts";

const { fs, env, terminal } = denoRuntime;

function markerPath(): string {
  const home = env.get("DEVSTATION_HOME") ?? defaultDevstationHome();
  return join(home, PENDING_MARKER);
}

/** Returns a user-facing notice if an update was applied, else null. */
export async function applyStagedUpdate(): Promise<string | null> {
  const path = markerPath();
  let pending: PendingUpdate;
  try {
    pending = JSON.parse(await fs.readTextFile(path)) as PendingUpdate;
  } catch {
    return null; // no marker (the common case) or unreadable
  }

  try {
    if (
      !pending.newPath || !pending.targetPath || !pending.previousPath
    ) {
      throw new Error("incomplete pending-update marker");
    }
    // Skip if the staged version isn't actually newer than what's running
    // (e.g. the swap already happened on a prior boot). "rollback" is a
    // sentinel that always applies.
    if (pending.version !== "rollback" && compareSemver(pending.version, VERSION) !== 1) {
      await safeRemove(path);
      await safeRemove(pending.newPath);
      return null;
    }

    // Move current → previous, then staged → current.
    try {
      await fs.rename(pending.targetPath, pending.previousPath);
    } catch {
      // target may already be gone (partial prior run); continue.
    }
    await fs.rename(pending.newPath, pending.targetPath);
    await safeRemove(path);

    const label = pending.version === "rollback" ? "previous version" : `v${pending.version}`;
    return `Applied update to ${label}. Restart devstation to use it.`;
  } catch (err) {
    // Don't let a botched update wedge the boot. Drop the marker and go.
    await safeRemove(path);
    try {
      terminal.writeStderrSync(
        new TextEncoder().encode(
          `devstation: staged update could not be applied (${
            err instanceof Error ? err.message : String(err)
          }); continuing on current version.\n`,
        ),
      );
    } catch { /* ignore */ }
    return null;
  }
}

async function safeRemove(path: string): Promise<void> {
  try {
    await fs.remove(path);
  } catch { /* already gone */ }
}
