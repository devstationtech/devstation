import type { LocalResourcesRecord } from "@server/auth/application/queries/local-resources/types/local-resources-record.ts";

/**
 * Cross-OS port for a CPU + RAM snapshot of the local host.
 *
 * Implementations are per-OS because the data sources don't overlap:
 *   Linux:   parses /proc/stat + /proc/meminfo (no subprocess).
 *   macOS:   shells out to `top -l 1` + `sysctl hw.memsize`.
 *   Windows: shells out to `powershell -c "Get-Counter ..."`.
 *
 * Each implementation is responsible for returning percentages
 * directly — there's no shared notion of "cpu ticks" across these
 * OSes that would justify pulling raw samples up here.
 *
 * Failures (file not found, command missing, parse error) MUST be
 * swallowed inside the adapter and returned as `{ cpuPercent: 0,
 * ramPercent: 0 }`. The header is non-critical UX; throwing here
 * would only spam the wire with errors the UI must ignore anyway.
 */
export interface LocalResourcesAdapter {
  snapshot(): Promise<LocalResourcesRecord>;
}
