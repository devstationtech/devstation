import { denoRuntime } from "@ui/shared/platform/deno-runtime.ts";
import type { Env, FileSystem, OsKind } from "@ui/shared/platform/runtime.ts";

/**
 * Per-OS executable conventions over the platform facade: Windows
 * binaries carry `.exe` and have no POSIX permission bits to set. Call
 * sites name the binary and mark it runnable without repeating the
 * OS branch (and without touching the host runtime directly).
 */
export function executableName(base: string, env: Env = denoRuntime.env): string {
  return env.os === "windows" ? `${base}.exe` : base;
}

/** chmod 755 where permission bits exist; no-op on Windows. */
export async function markExecutable(
  path: string,
  deps: { fs: FileSystem; os: OsKind } = { fs: denoRuntime.fs, os: denoRuntime.env.os },
): Promise<void> {
  if (deps.os === "windows") return;
  await deps.fs.chmod(path, 0o755);
}
