/**
 * Per-OS shutdown signal handler installer — UI mirror of the server's
 * `shared/platform/signals.ts`. Kept local (not imported from
 * `@server/...`) to preserve the zero-coupling invariant between
 * the UI and the engine.
 *
 * Signal subscription goes through the platform runtime facade (the
 * single `Deno.*` seam), so the UI stays portable to Bun/Node.
 *
 * Deno on Windows only allows subscribing to SIGINT and SIGBREAK;
 * SIGTERM / SIGHUP throw at registration. Linux/macOS take SIGINT,
 * SIGTERM, SIGHUP (and many more we don't use).
 */
import { denoRuntime } from "@ui/shared/platform/mod.ts";
import type { OsKind, Signal } from "@ui/shared/platform/mod.ts";

const { process, env } = denoRuntime;

export function installShutdownHandlers(
  handler: () => void,
  os: OsKind = env.os,
): () => void {
  const signals: Signal[] = os === "windows"
    ? ["SIGINT", "SIGBREAK"]
    : ["SIGINT", "SIGTERM", "SIGHUP"];

  for (const sig of signals) {
    process.onSignal(sig, handler);
  }
  return () => {
    for (const sig of signals) {
      process.offSignal(sig, handler);
    }
  };
}
