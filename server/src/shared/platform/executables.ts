/**
 * Per-OS executable conventions, centralized: Windows binaries carry
 * `.exe` and have no POSIX permission bits to set. Call sites name the
 * binary and mark it runnable without repeating the OS branch.
 */
export function executableName(base: string, os: typeof Deno.build.os = Deno.build.os): string {
  return os === "windows" ? `${base}.exe` : base;
}

/** chmod 755 where permission bits exist; no-op on Windows. */
export async function markExecutable(
  path: string,
  os: typeof Deno.build.os = Deno.build.os,
): Promise<void> {
  if (os === "windows") return;
  await Deno.chmod(path, 0o755);
}
