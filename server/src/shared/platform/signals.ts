/**
 * Per-OS shutdown signal handler installer.
 *
 * Deno limits which signals can be subscribed via `addSignalListener`
 * per platform:
 *
 *   POSIX (linux, darwin): SIGINT, SIGTERM, SIGHUP, and a long list more.
 *   Windows:               SIGINT, SIGBREAK only. SIGTERM and SIGHUP throw.
 *
 * Registering an unsupported signal raises at boot — the previous
 * unconditional `Deno.addSignalListener("SIGTERM", …)` calls in the
 * server entrypoints would prevent Windows boot before any request was
 * served. This helper picks the subset the host actually accepts and
 * installs the handler against each, returning a `cleanup` callback
 * that removes them — useful for tests that need to install and undo.
 */
export function installShutdownHandlers(
  handler: () => void,
  os: typeof Deno.build.os = Deno.build.os,
): () => void {
  const signals: Deno.Signal[] = os === "windows"
    // SIGBREAK fires on Ctrl-Break in Windows console; SIGINT on Ctrl-C.
    // No SIGTERM equivalent — the platform's graceful-stop is "close the
    // console window" which doesn't deliver a signal at all.
    ? ["SIGINT", "SIGBREAK"]
    // POSIX trio: Ctrl-C, `kill <pid>` default, terminal hangup.
    : ["SIGINT", "SIGTERM", "SIGHUP"];

  for (const sig of signals) {
    Deno.addSignalListener(sig, handler);
  }

  return () => {
    for (const sig of signals) {
      Deno.removeSignalListener(sig, handler);
    }
  };
}
