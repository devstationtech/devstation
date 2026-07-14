import type { LocalResourcesAdapter } from "@server/auth/application/queries/local-resources/adapter.ts";
import type { LocalResourcesRecord } from "@server/auth/application/queries/local-resources/types/local-resources-record.ts";

/**
 * Pass-through query over the per-OS `LocalResourcesAdapter`. The
 * read happens entirely in the adapter (each OS uses different data
 * sources: /proc on Linux, `top` + `sysctl` on macOS, PowerShell on
 * Windows); this query exists so the inbound endpoint stays neutral
 * to the platform-specific wiring.
 *
 * The adapter is a singleton — registered once in the DI container —
 * because some implementations (Linux's delta-based CPU%) carry state
 * across calls. Composition root picks the impl by `Deno.build.os`.
 */
export class Query {
  constructor(private readonly adapter: LocalResourcesAdapter) {}

  execute(): Promise<LocalResourcesRecord> {
    return this.adapter.snapshot();
  }
}
